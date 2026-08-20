import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';
import { calculateHarvestForCrop } from '../services/harvestService.js';

// pg returns numeric columns as strings, which silently breaks recharts.
function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// How many crops get their own line on the price-trend chart.
const TREND_CROP_LIMIT = 5;

export const getHarvestAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    // Super admins oversee every farm, so they have no farm of their own to
    // scope to - a NULL farm id means "all farms" in every query below.
    const isAdmin = String(req.user.role || '').toLowerCase() === 'super_admin';
    const farmId = isAdmin ? null : await getDefaultFarmId(userId);
    const { from, to } = req.query;

    // NULL bounds mean "no limit", so the same query serves the unfiltered view.
    const range = [farmId, from || null, to || null];
    const dateFilter = `
      AND ($2::date IS NULL OR h.harvest_date >= $2::date)
      AND ($3::date IS NULL OR h.harvest_date <= $3::date)
    `;

    const [totalsRes, overTimeRes, byCropRes, trendRes, marketplaceRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS batches,
          COUNT(DISTINCT h.crop_name)::int AS crops,
          COALESCE(SUM(h.total_revenue), 0)::float8 AS gross_revenue,
          COALESCE(SUM(h.total_expenses), 0)::float8 AS expenses,
          COALESCE(SUM(h.net_profit), 0)::float8 AS revenue,
          COALESCE(SUM(h.quantity), 0)::float8 AS quantity,
          COALESCE(
            SUM(h.total_revenue) / NULLIF(SUM(h.quantity), 0), 0
          )::float8 AS avg_price,
          COALESCE(
            SUM(h.net_profit) / NULLIF(SUM(h.total_revenue), 0) * 100, 0
          )::float8 AS margin,
          MIN(h.harvest_date)::text AS first_harvest,
          MAX(h.harvest_date)::text AS last_harvest
        FROM crop_harvests h
        WHERE ($1::uuid IS NULL OR h.farm_id = $1::uuid) ${dateFilter}
      `, range),

      pool.query(`
        SELECT
          to_char(date_trunc('month', h.harvest_date), 'YYYY-MM') AS month,
          COALESCE(SUM(h.total_revenue), 0)::float8 AS gross_revenue,
          COALESCE(SUM(h.total_expenses), 0)::float8 AS expenses,
          COALESCE(SUM(h.net_profit), 0)::float8 AS revenue,
          COALESCE(SUM(h.quantity), 0)::float8 AS quantity,
          COUNT(*)::int AS batches
        FROM crop_harvests h
        WHERE ($1::uuid IS NULL OR h.farm_id = $1::uuid) ${dateFilter}
        GROUP BY 1
        ORDER BY 1
      `, range),

      pool.query(`
        SELECT
          h.crop_name,
          COUNT(*)::int AS batches,
          COALESCE(SUM(h.quantity), 0)::float8 AS quantity,
          MAX(h.unit) AS unit,
          COALESCE(SUM(h.total_revenue), 0)::float8 AS gross_revenue,
          COALESCE(SUM(h.total_expenses), 0)::float8 AS expenses,
          COALESCE(SUM(h.net_profit), 0)::float8 AS revenue,
          COALESCE(
            SUM(h.total_revenue) / NULLIF(SUM(h.quantity), 0), 0
          )::float8 AS avg_price,
          COALESCE(
            SUM(h.net_profit) / NULLIF(SUM(h.total_revenue), 0) * 100, 0
          )::float8 AS margin
        FROM crop_harvests h
        WHERE ($1::uuid IS NULL OR h.farm_id = $1::uuid) ${dateFilter}
        GROUP BY h.crop_name
        ORDER BY revenue DESC
      `, range),

      // One point per crop per month, restricted to the crops that actually
      // move the needle so the chart stays readable.
      pool.query(`
        WITH top_crops AS (
          SELECT h.crop_name
          FROM crop_harvests h
          WHERE ($1::uuid IS NULL OR h.farm_id = $1::uuid) ${dateFilter}
          GROUP BY h.crop_name
          ORDER BY SUM(h.total_revenue) DESC
          LIMIT ${TREND_CROP_LIMIT}
        )
        SELECT
          to_char(date_trunc('month', h.harvest_date), 'YYYY-MM') AS month,
          h.crop_name,
          COALESCE(AVG(h.price_per_unit), 0)::float8 AS avg_price
        FROM crop_harvests h
        JOIN top_crops tc ON tc.crop_name = h.crop_name
        WHERE ($1::uuid IS NULL OR h.farm_id = $1::uuid) ${dateFilter}
        GROUP BY 1, 2
        ORDER BY 1, 2
      `, range),

      // orders.farm_id is not populated by the checkout flow, so the farm is
      // resolved through the product that was sold.
      pool.query(`
        SELECT
          to_char(date_trunc('month', o.placed_at), 'YYYY-MM') AS month,
          COALESCE(SUM(oi.line_total), 0)::float8 AS revenue,
          COUNT(DISTINCT o.id)::int AS orders
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE ($1::uuid IS NULL OR COALESCE(o.farm_id, p.farm_id) = $1::uuid)
          AND LOWER(COALESCE(o.payment_status::text, '')) = 'paid'
          AND ($2::date IS NULL OR o.placed_at >= $2::date)
          AND ($3::date IS NULL OR o.placed_at < ($3::date + INTERVAL '1 day'))
        GROUP BY 1
        ORDER BY 1
      `, range),
    ]);

    const totals = totalsRes.rows[0] || {};
    const byCrop = byCropRes.rows;

    // `revenue` throughout is revenue after expenses; the pre-expense figure is
    // reported separately as `gross_revenue`.
    res.json({
      totals: {
        batches: num(totals.batches),
        crops: num(totals.crops),
        gross_revenue: num(totals.gross_revenue),
        expenses: num(totals.expenses),
        revenue: num(totals.revenue),
        quantity: num(totals.quantity),
        avg_price: num(totals.avg_price),
        margin: num(totals.margin),
        first_harvest: totals.first_harvest || null,
        last_harvest: totals.last_harvest || null,
        top_crop: byCrop[0]?.crop_name || null,
        currency: 'LKR',
      },
      revenue_over_time: overTimeRes.rows.map((row) => ({
        month: row.month,
        gross_revenue: num(row.gross_revenue),
        expenses: num(row.expenses),
        revenue: num(row.revenue),
        quantity: num(row.quantity),
        batches: num(row.batches),
      })),
      by_crop: byCrop.map((row) => ({
        crop_name: row.crop_name,
        batches: num(row.batches),
        quantity: num(row.quantity),
        unit: row.unit || 'kg',
        gross_revenue: num(row.gross_revenue),
        expenses: num(row.expenses),
        revenue: num(row.revenue),
        avg_price: num(row.avg_price),
        margin: num(row.margin),
      })),
      price_trends: trendRes.rows.map((row) => ({
        month: row.month,
        crop_name: row.crop_name,
        avg_price: num(row.avg_price),
      })),
      marketplace_sales: marketplaceRes.rows.map((row) => ({
        month: row.month,
        revenue: num(row.revenue),
        orders: num(row.orders),
      })),
    });
  } catch (error) {
    console.error('Error building harvest analytics:', error);
    res.status(500).json({ error: 'Failed to build harvest analytics.' });
  }
};

// The farm's most recent harvests and livestock collections, shaped for the
// "My Products" listing form so a farmer picks what they just harvested
// instead of retyping the name, quantity and date.
export const getRecentProduce = async (req, res) => {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);
    const limit = Math.min(Number(req.query.limit) || 40, 100);

    const result = await pool.query(`
      (
        SELECT h.id, 'crop' AS source, h.crop_name AS name, h.variety AS detail,
               h.harvest_date AS record_date, h.quantity::float8 AS quantity,
               h.unit, h.price_per_unit::float8 AS price_per_unit,
               ff.field_name AS location
        FROM crop_harvests h
        LEFT JOIN farm_fields ff ON ff.id = h.field_id
        WHERE h.farm_id = $1
      )
      UNION ALL
      (
        SELECT p.id, 'livestock' AS source,
               COALESCE(p.product_type, p.species, 'Livestock') AS name,
               p.species AS detail,
               p.production_date AS record_date, p.quantity::float8 AS quantity,
               p.unit, p.price_per_unit::float8 AS price_per_unit,
               g.group_code AS location
        FROM livestock_production p
        LEFT JOIN livestock_groups g ON g.id = p.group_id
        WHERE p.farm_id = $1
      )
      ORDER BY record_date DESC
      LIMIT $2
    `, [farmId, limit]);

    res.json(result.rows.map((row) => ({
      ...row,
      record_date: row.record_date ? row.record_date.toISOString().slice(0, 10) : null,
      // Suggested marketplace category so picking a harvest fills the whole form.
      category: suggestCategory(row),
    })));
  } catch (error) {
    console.error('Error listing recent produce:', error);
    res.status(500).json({ error: 'Failed to load recent harvests.' });
  }
};

const FRUITS = ['mango', 'papaya', 'lemon', 'banana', 'coconut', 'pineapple', 'guava', 'avocado'];
const GRAINS = ['paddy', 'rice', 'corn', 'maize', 'wheat', 'millet'];

function suggestCategory(row) {
  const name = String(row.name || '').toLowerCase();
  if (row.source === 'livestock') {
    if (name.includes('milk') || name.includes('egg')) return 'Dairy';
    if (name.includes('meat')) return 'Meat';
    return 'Other';
  }
  if (FRUITS.some((f) => name.includes(f))) return 'Fruit';
  if (GRAINS.some((g) => name.includes(g))) return 'Grain';
  return 'Vegetable';
}

// Every harvest ever recorded - crops and livestock together - for the manager
// and admin production history page.
export const getProductionRecords = async (req, res) => {
  try {
    const isAdmin = String(req.user.role || '').toLowerCase() === 'super_admin';
    const farmId = isAdmin ? null : await getDefaultFarmId(req.user.userId);
    const { from, to, source } = req.query;
    const params = [farmId, from || null, to || null];

    const wantCrops = !source || source === 'all' || source === 'crop';
    const wantLivestock = !source || source === 'all' || source === 'livestock';

    const [cropRes, livestockRes] = await Promise.all([
      wantCrops ? pool.query(`
        SELECT
          h.id, 'crop' AS source, h.crop_name AS item, h.variety AS detail,
          h.harvest_date AS record_date,
          h.quantity::float8 AS quantity, h.unit,
          h.price_per_unit::float8 AS price_per_unit,
          h.total_revenue::float8 AS value,
          h.total_expenses::float8 AS expenses,
          h.net_profit::float8 AS net,
          h.notes, ff.field_name AS location,
          f.name AS farm_name,
          u.full_name AS recorded_by_name,
          COALESCE(m.is_perennial, FALSE) AS is_perennial
        FROM crop_harvests h
        LEFT JOIN farm_fields ff ON ff.id = h.field_id
        LEFT JOIN farms f ON f.id = h.farm_id
        LEFT JOIN app_users u ON u.id = h.recorded_by
        LEFT JOIN crop_master m ON m.crop_name = h.crop_name
        WHERE ($1::uuid IS NULL OR h.farm_id = $1::uuid)
          AND ($2::date IS NULL OR h.harvest_date >= $2::date)
          AND ($3::date IS NULL OR h.harvest_date <= $3::date)
      `, params) : { rows: [] },

      wantLivestock ? pool.query(`
        SELECT
          p.id, 'livestock' AS source, COALESCE(p.species, 'Livestock') AS item,
          p.product_type AS detail,
          p.production_date AS record_date,
          p.quantity::float8 AS quantity, p.unit,
          p.price_per_unit::float8 AS price_per_unit,
          p.total_value::float8 AS value,
          0::float8 AS expenses,
          p.total_value::float8 AS net,
          p.notes, g.group_code AS location,
          f.name AS farm_name,
          u.full_name AS recorded_by_name,
          FALSE AS is_perennial
        FROM livestock_production p
        LEFT JOIN livestock_groups g ON g.id = p.group_id
        LEFT JOIN farms f ON f.id = p.farm_id
        LEFT JOIN app_users u ON u.id = p.recorded_by
        WHERE ($1::uuid IS NULL OR p.farm_id = $1::uuid)
          AND ($2::date IS NULL OR p.production_date >= $2::date)
          AND ($3::date IS NULL OR p.production_date <= $3::date)
      `, params) : { rows: [] },
    ]);

    const rows = [...cropRes.rows, ...livestockRes.rows]
      .map((row) => ({
        ...row,
        record_date: row.record_date ? row.record_date.toISOString().slice(0, 10) : null,
      }))
      .sort((a, b) => String(b.record_date || '').localeCompare(String(a.record_date || '')));

    const totals = rows.reduce((acc, row) => ({
      records: acc.records + 1,
      value: acc.value + num(row.value),
      expenses: acc.expenses + num(row.expenses),
      net: acc.net + num(row.net),
      crop_records: acc.crop_records + (row.source === 'crop' ? 1 : 0),
      livestock_records: acc.livestock_records + (row.source === 'livestock' ? 1 : 0),
    }), { records: 0, value: 0, expenses: 0, net: 0, crop_records: 0, livestock_records: 0 });

    // Quantities only make sense grouped by unit (kg vs nuts vs litre vs eggs).
    const byUnit = {};
    for (const row of rows) {
      const unit = row.unit || 'unit';
      byUnit[unit] = (byUnit[unit] || 0) + num(row.quantity);
    }

    res.json({ rows, totals, quantities_by_unit: byUnit, currency: 'LKR' });
  } catch (error) {
    console.error('Error listing production records:', error);
    res.status(500).json({ error: 'Failed to load production records.' });
  }
};

const EXPENSE_FIELDS = ['seed_cost', 'fertilizer_cost', 'pesticide_cost', 'machinery_cost', 'other_cost'];

// Super admins oversee every farm; everyone else is scoped to their own.
async function resolveFarmScope(req) {
  if (String(req.user.role || '').toLowerCase() === 'super_admin') return null;
  return getDefaultFarmId(req.user.userId);
}

export const listHarvestExpenses = async (req, res) => {
  try {
    const farmId = await resolveFarmScope(req);
    const { from, to, crop } = req.query;

    const result = await pool.query(`
      SELECT
        h.id, h.crop_name, h.variety, h.harvest_date, h.quantity, h.unit,
        h.price_per_unit::float8 AS price_per_unit,
        h.seed_cost::float8 AS seed_cost,
        h.fertilizer_cost::float8 AS fertilizer_cost,
        h.pesticide_cost::float8 AS pesticide_cost,
        h.machinery_cost::float8 AS machinery_cost,
        h.other_cost::float8 AS other_cost,
        h.total_expenses::float8 AS total_expenses,
        h.total_revenue::float8 AS total_revenue,
        h.net_profit::float8 AS net_profit,
        h.notes,
        f.name AS farm_name,
        ff.field_name
      FROM crop_harvests h
      LEFT JOIN farms f ON f.id = h.farm_id
      LEFT JOIN farm_fields ff ON ff.id = h.field_id
      WHERE ($1::uuid IS NULL OR h.farm_id = $1::uuid)
        AND ($2::date IS NULL OR h.harvest_date >= $2::date)
        AND ($3::date IS NULL OR h.harvest_date <= $3::date)
        AND ($4::text IS NULL OR h.crop_name = $4::text)
      ORDER BY h.harvest_date DESC, h.crop_name
    `, [farmId, from || null, to || null, crop || null]);

    const rows = result.rows.map((row) => ({
      ...row,
      quantity: num(row.quantity),
      harvest_date: row.harvest_date ? row.harvest_date.toISOString().slice(0, 10) : null,
    }));

    const totals = rows.reduce((acc, row) => ({
      expenses: acc.expenses + num(row.total_expenses),
      revenue: acc.revenue + num(row.total_revenue),
      net: acc.net + num(row.net_profit),
      seed_cost: acc.seed_cost + num(row.seed_cost),
      fertilizer_cost: acc.fertilizer_cost + num(row.fertilizer_cost),
      pesticide_cost: acc.pesticide_cost + num(row.pesticide_cost),
      machinery_cost: acc.machinery_cost + num(row.machinery_cost),
      other_cost: acc.other_cost + num(row.other_cost),
    }), { expenses: 0, revenue: 0, net: 0, seed_cost: 0, fertilizer_cost: 0, pesticide_cost: 0, machinery_cost: 0, other_cost: 0 });

    res.json({ rows, totals, currency: 'LKR' });
  } catch (error) {
    console.error('Error listing harvest expenses:', error);
    res.status(500).json({ error: 'Failed to load expenses.' });
  }
};

export const updateHarvestExpenses = async (req, res) => {
  try {
    const farmId = await resolveFarmScope(req);
    const { id } = req.params;

    const updates = [];
    const values = [id, farmId];

    for (const field of EXPENSE_FIELDS) {
      if (req.body[field] !== undefined) {
        const amount = Number(req.body[field]);
        if (!Number.isFinite(amount) || amount < 0) {
          return res.status(400).json({ error: `${field} must be a positive number.` });
        }
        values.push(amount);
        updates.push(`${field} = $${values.length}`);
      }
    }

    if (req.body.notes !== undefined) {
      values.push(req.body.notes || null);
      updates.push(`notes = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No expense values supplied.' });
    }

    const result = await pool.query(`
      UPDATE crop_harvests
      SET ${updates.join(', ')}, updated_at = now()
      WHERE id = $1 AND ($2::uuid IS NULL OR farm_id = $2::uuid)
      RETURNING id, crop_name, harvest_date,
        seed_cost::float8 AS seed_cost,
        fertilizer_cost::float8 AS fertilizer_cost,
        pesticide_cost::float8 AS pesticide_cost,
        machinery_cost::float8 AS machinery_cost,
        other_cost::float8 AS other_cost,
        total_expenses::float8 AS total_expenses,
        total_revenue::float8 AS total_revenue,
        net_profit::float8 AS net_profit
    `, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Harvest record not found for this farm.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating harvest expenses:', error);
    res.status(500).json({ error: 'Failed to update expenses.' });
  }
};

// Tell the farm's managers that a worker logged a harvest.
async function notifyFarmManagers(farmId, actorId, cropName, harvestDate, quantity, unit) {
  try {
    const actorRes = await pool.query('SELECT full_name FROM app_users WHERE id = $1', [actorId]);
    const actor = actorRes.rows[0]?.full_name || 'A worker';

    const managers = await pool.query(`
      SELECT DISTINCT u.id
      FROM app_users u
      LEFT JOIN farm_memberships fm ON fm.user_id = u.id AND fm.farm_id = $1
      LEFT JOIN farms f ON f.id = $1
      WHERE (fm.user_id IS NOT NULL OR f.owner_user_id = u.id)
        AND LOWER(u.role::text) IN ('farm_manager', 'super_admin')
    `, [farmId]);

    const message = `${actor} recorded a ${cropName} harvest of ${quantity} ${unit} on ${harvestDate}.`;
    for (const manager of managers.rows) {
      await pool.query(`
        INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
        VALUES ($1, $2, 'harvest', 'Harvest Recorded', $3, 'Normal', 'in-app')
      `, [manager.id, farmId, message]);
    }
  } catch (error) {
    // A failed notification must never lose the harvest record itself.
    console.error('Failed to notify managers of harvest:', error);
  }
}

// Crops a farmer can log a harvest against: the perennial trees that keep
// bearing (Coconut, Mango, Papaya, Lemon), plus any seasonal planting that has
// not been harvested yet, so an upcoming harvest can be recorded when it happens.
export const getPerennialCrops = async (req, res) => {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);

    const result = await pool.query(`
      SELECT
        c.id, c.crop_name, c.variety, c.planting_date, c.status::text AS cycle_status,
        c.expected_harvest_date AS next_harvest_date,
        c.harvest_status, c.remaining_days, c.harvest_progress,
        c.yield_unit,
        COALESCE(m.is_perennial, FALSE) AS is_perennial,
        m.harvest_type, m.harvest_frequency,
        ff.field_name,
        COALESCE(h.harvest_count, 0)::int AS harvest_count,
        h.last_harvest_date,
        h.last_unit,
        h.last_price::float8 AS last_price,
        COALESCE(h.total_quantity, 0)::float8 AS total_quantity
      FROM crop_cycles c
      LEFT JOIN crop_master m ON m.crop_name = c.crop_name
      LEFT JOIN farm_fields ff ON ff.id = c.field_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS harvest_count,
               MAX(harvest_date) AS last_harvest_date,
               SUM(quantity) AS total_quantity,
               (ARRAY_AGG(unit ORDER BY harvest_date DESC))[1] AS last_unit,
               (ARRAY_AGG(price_per_unit ORDER BY harvest_date DESC))[1] AS last_price
        FROM crop_harvests ch WHERE ch.crop_cycle_id = c.id
      ) h ON TRUE
      WHERE c.farm_id = $1
        AND (
          COALESCE(m.is_perennial, FALSE) = TRUE
          -- Seasonal plantings still in the ground: their harvest is yet to come.
          OR (c.is_historical = FALSE AND c.status NOT IN ('harvested', 'failed'))
        )
      ORDER BY COALESCE(m.is_perennial, FALSE) DESC, c.remaining_days NULLS LAST, c.crop_name
    `, [farmId]);

    res.json(result.rows.map((row) => ({
      ...row,
      harvest_date_hint: row.last_harvest_date,
      unit: row.last_unit || row.yield_unit || (row.crop_name === 'Coconut' ? 'nuts' : 'kg'),
    })));
  } catch (error) {
    console.error('Error listing perennial crops:', error);
    res.status(500).json({ error: 'Failed to load perennial crops.' });
  }
};

// Livestock groups a farmer can log production against, with a sensible default
// product for the species so the form is one tap for the common case.
export const getLivestockGroups = async (req, res) => {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);

    const result = await pool.query(`
      SELECT
        g.id, g.species, g.breed, g.group_code, g.status,
        -- Headcount comes from the animals actually registered in Livestock
        -- Management, not the group's own tally, which is seed data that can
        -- claim animals the farm does not have.
        COALESCE(a.animal_count, 0)::int AS count_current,
        COALESCE(p.entries, 0)::int AS entries,
        p.last_production_date,
        p.last_product_type,
        p.last_unit,
        p.last_price::float8 AS last_price,
        COALESCE(p.total_quantity, 0)::float8 AS total_quantity
      FROM livestock_groups g
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS entries,
               MAX(production_date) AS last_production_date,
               SUM(quantity) AS total_quantity,
               (ARRAY_AGG(product_type ORDER BY production_date DESC))[1] AS last_product_type,
               (ARRAY_AGG(unit ORDER BY production_date DESC))[1] AS last_unit,
               (ARRAY_AGG(price_per_unit ORDER BY production_date DESC))[1] AS last_price
        FROM livestock_production lp WHERE lp.group_id = g.id
      ) p ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS animal_count
        FROM livestock_animals la WHERE la.group_id = g.id
      ) a ON TRUE
      WHERE g.farm_id = $1
        -- Only livestock that actually exist on the farm right now. Add an
        -- animal in Livestock Management and its group appears here; remove
        -- the last one and the group drops off.
        AND COALESCE(a.animal_count, 0) > 0
      ORDER BY g.species, g.breed NULLS LAST
    `, [farmId]);

    res.json(result.rows.map((row) => {
      const species = String(row.species || '').toLowerCase();
      const defaults = species.includes('layer') || species.includes('poultry')
        ? { product_type: species.includes('broiler') ? 'Meat' : 'Eggs', unit: species.includes('broiler') ? 'kg' : 'eggs' }
        : species.includes('cattle') || species.includes('buffalo') || species.includes('goat')
          ? { product_type: 'Milk', unit: 'litre' }
          : { product_type: 'Other', unit: 'kg' };

      return {
        ...row,
        default_product_type: row.last_product_type || defaults.product_type,
        default_unit: row.last_unit || defaults.unit,
      };
    }));
  } catch (error) {
    console.error('Error listing livestock groups:', error);
    res.status(500).json({ error: 'Failed to load livestock groups.' });
  }
};

export const createLivestockProduction = async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const { group_id, product_type, production_date, quantity, unit, price_per_unit, notes } = req.body;

    if (!product_type || !production_date) {
      return res.status(400).json({ error: 'Product type and date are required.' });
    }

    let species = req.body.species || null;
    if (!species && group_id) {
      const groupRes = await pool.query('SELECT species FROM livestock_groups WHERE id = $1 AND farm_id = $2', [group_id, farmId]);
      species = groupRes.rows[0]?.species || null;
    }

    const result = await pool.query(`
      INSERT INTO livestock_production (
        farm_id, group_id, species, product_type, production_date,
        quantity, unit, price_per_unit, notes, recorded_by
      ) VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      farmId, group_id || null, species, product_type, production_date,
      Number(quantity) || 0, unit || 'litre', Number(price_per_unit) || 0,
      notes || null, userId,
    ]);

    await notifyFarmManagers(
      farmId, userId,
      `${species || 'Livestock'} ${product_type}`,
      production_date, Number(quantity) || 0, unit || 'litre',
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error recording livestock production:', error);
    res.status(500).json({ error: 'Failed to record production.' });
  }
};

export const getLivestockProduction = async (req, res) => {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);
    const { from, to } = req.query;

    const result = await pool.query(`
      SELECT
        p.id, p.group_id, p.species, p.product_type, p.production_date,
        p.quantity::float8 AS quantity, p.unit,
        p.price_per_unit::float8 AS price_per_unit,
        p.total_value::float8 AS total_value,
        p.notes,
        g.breed, g.group_code,
        u.full_name AS recorded_by_name
      FROM livestock_production p
      LEFT JOIN livestock_groups g ON g.id = p.group_id
      LEFT JOIN app_users u ON u.id = p.recorded_by
      WHERE p.farm_id = $1
        AND ($2::date IS NULL OR p.production_date >= $2::date)
        AND ($3::date IS NULL OR p.production_date <= $3::date)
      ORDER BY p.production_date DESC, p.created_at DESC
    `, [farmId, from || null, to || null]);

    res.json(result.rows.map((row) => ({
      ...row,
      production_date: row.production_date ? row.production_date.toISOString().slice(0, 10) : null,
    })));
  } catch (error) {
    console.error('Error listing livestock production:', error);
    res.status(500).json({ error: 'Failed to load production records.' });
  }
};

// Recorded harvest events for the manager's harvest calendar.
export const getHarvestEvents = async (req, res) => {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);
    const { from, to } = req.query;

    const result = await pool.query(`
      SELECT
        h.id, h.crop_cycle_id, h.crop_name, h.variety, h.harvest_date,
        h.quantity::float8 AS quantity, h.unit,
        h.price_per_unit::float8 AS price_per_unit,
        h.total_revenue::float8 AS total_revenue,
        h.notes,
        ff.field_name,
        u.full_name AS recorded_by_name,
        COALESCE(m.is_perennial, FALSE) AS is_perennial
      FROM crop_harvests h
      LEFT JOIN farm_fields ff ON ff.id = h.field_id
      LEFT JOIN app_users u ON u.id = h.recorded_by
      LEFT JOIN crop_master m ON m.crop_name = h.crop_name
      WHERE h.farm_id = $1
        AND ($2::date IS NULL OR h.harvest_date >= $2::date)
        AND ($3::date IS NULL OR h.harvest_date <= $3::date)
      ORDER BY h.harvest_date DESC
    `, [farmId, from || null, to || null]);

    res.json(result.rows.map((row) => ({
      ...row,
      harvest_date: row.harvest_date ? row.harvest_date.toISOString().slice(0, 10) : null,
    })));
  } catch (error) {
    console.error('Error listing harvest events:', error);
    res.status(500).json({ error: 'Failed to load harvest events.' });
  }
};

// Lets a manager log a harvest that was never imported, so the expense page is
// not limited to spreadsheet rows.
export const createHarvestRecord = async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const {
      crop_name, variety, harvest_date, quantity, unit, price_per_unit,
      crop_cycle_id, field_id, notes,
    } = req.body;

    if (!crop_name || !harvest_date) {
      return res.status(400).json({ error: 'Crop and harvest date are required.' });
    }

    // Inherit the field from the crop cycle when the caller did not supply one,
    // so the harvest still shows against the right field on the calendar.
    let resolvedFieldId = field_id || null;
    if (!resolvedFieldId && crop_cycle_id) {
      const cycleRes = await pool.query('SELECT field_id FROM crop_cycles WHERE id = $1 AND farm_id = $2', [crop_cycle_id, farmId]);
      resolvedFieldId = cycleRes.rows[0]?.field_id || null;
    }

    // Farmers record what they picked, not what it is worth - the farm manager
    // sets prices. Carry the crop's last recorded rate forward so revenue
    // reporting stays meaningful until the manager prices the batch.
    let resolvedPrice = Number(price_per_unit) || 0;
    if (!resolvedPrice) {
      const priceRes = await pool.query(`
        SELECT price_per_unit::float8 AS price
        FROM crop_harvests
        WHERE farm_id = $1 AND crop_name = $2 AND price_per_unit > 0
        ORDER BY harvest_date DESC
        LIMIT 1
      `, [farmId, crop_name]);
      resolvedPrice = Number(priceRes.rows[0]?.price) || 0;
    }

    const result = await pool.query(`
      INSERT INTO crop_harvests (
        farm_id, crop_cycle_id, field_id, crop_name, variety, harvest_date,
        quantity, unit, price_per_unit, currency,
        seed_cost, fertilizer_cost, pesticide_cost, machinery_cost, other_cost, notes,
        recorded_by, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, 'LKR', $10, $11, $12, $13, $14, $15, $16, now())
      RETURNING id
    `, [
      farmId, crop_cycle_id || null, resolvedFieldId, crop_name, variety || null, harvest_date,
      Number(quantity) || 0, unit || 'kg', resolvedPrice,
      Number(req.body.seed_cost) || 0, Number(req.body.fertilizer_cost) || 0,
      Number(req.body.pesticide_cost) || 0, Number(req.body.machinery_cost) || 0,
      Number(req.body.other_cost) || 0, notes || null, userId,
    ]);

    if (crop_cycle_id) {
      const perennialRes = await pool.query(`
        SELECT COALESCE(m.is_perennial, FALSE) AS is_perennial
        FROM crop_cycles c
        LEFT JOIN crop_master m ON m.crop_name = c.crop_name
        WHERE c.id = $1
      `, [crop_cycle_id]);

      if (perennialRes.rows[0]?.is_perennial) {
        // The tree lives on - recording a pick just resets the countdown to the
        // next one, which is what the manager's harvest calendar reads.
        await calculateHarvestForCrop(crop_cycle_id);
      } else {
        // A seasonal planting is finished once it has been harvested.
        await pool.query(`
          UPDATE crop_cycles
          SET status = 'harvested', harvest_status = 'Harvested',
              actual_harvest_date = $2::date, harvest_progress = 100, remaining_days = 0,
              updated_at = now()
          WHERE id = $1
        `, [crop_cycle_id, harvest_date]);
      }

      await notifyFarmManagers(farmId, userId, crop_name, harvest_date, Number(quantity) || 0, unit || 'kg');
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    // Unique index on (crop_cycle_id, harvest_date).
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'That crop cycle already has a harvest recorded on this date. Edit the existing batch instead.',
      });
    }
    console.error('Error creating harvest record:', error);
    res.status(500).json({ error: 'Failed to create harvest record.' });
  }
};
