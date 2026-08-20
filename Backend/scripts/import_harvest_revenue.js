import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The workbook with expense columns supersedes the revenue-only one; both share
// the same Harvest Records layout, so either can be passed on the command line.
const DEFAULT_WORKBOOK = path.resolve(__dirname, '../../farm_harvest_revenue with expense.xlsx');

// Excel stores dates as a serial number counted from 1900; same conversion the
// Vavuniya importer uses (services/excelImportService.js).
function excelDate(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') {
    const parsed = new Date((raw - (25567 + 2)) * 86400 * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function importHarvestRevenue(filePath = DEFAULT_WORKBOOK) {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets['Harvest Records'];
  if (!sheet) throw new Error("Workbook has no 'Harvest Records' sheet");

  // Header is the first row here, unlike the Vavuniya workbook's 3 title rows.
  const rows = xlsx.utils.sheet_to_json(sheet);

  const stats = { read: 0, inserted: 0, updated: 0, unmatched: [], drift: [] };
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      const cropName = row['Crop'];
      // Skips the trailing TOTAL row and the trailing Note row.
      if (!cropName || String(cropName).startsWith('Note:')) continue;

      const variety = row['Variety'] ? String(row['Variety']) : null;
      const plantingDate = excelDate(row['Planting Date']);
      const harvestDate = excelDate(row['Actual Harvest Date']);
      const quantity = toNumber(row['Quantity Harvested']);
      const unit = row['Unit'] ? String(row['Unit']) : 'kg';
      const price = toNumber(row['Price per Unit (LKR)']);
      const sheetRevenue = toNumber(row['Total Revenue (LKR)']);

      // Expense columns are absent from the older revenue-only workbook.
      const seed = toNumber(row['Seed/Planting (LKR)']);
      const fertilizer = toNumber(row['Fertilizer (LKR)']);
      const pesticide = toNumber(row['Pesticide/Herbicide (LKR)']);
      const machinery = toNumber(row['Machinery/Harvesting Charge (LKR)']);
      const sheetExpenses = toNumber(row['Total Expenses (LKR)']);

      if (!harvestDate) {
        stats.unmatched.push({ cropName, variety, plantingDate, reason: 'no actual harvest date' });
        continue;
      }
      stats.read += 1;

      // total_revenue and total_expenses are generated columns; flag any row where
      // the sheet's own totals disagree with their parts.
      const computed = Number((quantity * price).toFixed(2));
      if (Math.abs(computed - sheetRevenue) > 0.01) {
        stats.drift.push({ cropName, plantingDate, field: 'revenue', sheet: sheetRevenue, computed });
      }
      const computedExpenses = Number((seed + fertilizer + pesticide + machinery).toFixed(2));
      if (sheetExpenses && Math.abs(computedExpenses - sheetExpenses) > 0.01) {
        stats.drift.push({ cropName, plantingDate, field: 'expenses', sheet: sheetExpenses, computed: computedExpenses });
      }

      // Every spreadsheet row corresponds to a crop cycle that already exists.
      // (crop_name, variety, planting_date, actual_harvest_date) is unique across
      // all cycles, so this resolves to exactly one row.
      const cycleRes = await client.query(`
        SELECT id, farm_id, field_id
        FROM crop_cycles
        WHERE crop_name = $1
          AND COALESCE(variety, '') = COALESCE($2, '')
          AND planting_date = $3::date
          AND actual_harvest_date = $4::date
        LIMIT 1
      `, [cropName, variety, plantingDate, harvestDate]);

      if (cycleRes.rowCount === 0) {
        stats.unmatched.push({ cropName, variety, plantingDate, harvestDate, reason: 'no matching crop cycle' });
        continue;
      }

      const cycle = cycleRes.rows[0];
      const upsert = await client.query(`
        INSERT INTO crop_harvests (
          farm_id, crop_cycle_id, field_id, crop_name, variety,
          harvest_date, quantity, unit, price_per_unit, currency,
          seed_cost, fertilizer_cost, pesticide_cost, machinery_cost
        ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, 'LKR', $10, $11, $12, $13)
        ON CONFLICT (crop_cycle_id, harvest_date) DO UPDATE
        SET quantity = EXCLUDED.quantity,
            unit = EXCLUDED.unit,
            price_per_unit = EXCLUDED.price_per_unit,
            field_id = EXCLUDED.field_id,
            variety = EXCLUDED.variety,
            seed_cost = EXCLUDED.seed_cost,
            fertilizer_cost = EXCLUDED.fertilizer_cost,
            pesticide_cost = EXCLUDED.pesticide_cost,
            machinery_cost = EXCLUDED.machinery_cost,
            updated_at = now()
        RETURNING (xmax = 0) AS inserted
      `, [
        cycle.farm_id, cycle.id, cycle.field_id, cropName, variety, harvestDate,
        quantity, unit, price, seed, fertilizer, pesticide, machinery,
      ]);

      if (upsert.rows[0].inserted) stats.inserted += 1;
      else stats.updated += 1;
    }

    await client.query('COMMIT');
    return stats;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  const filePath = process.argv[2] || DEFAULT_WORKBOOK;
  console.log(`Importing harvest revenue from ${filePath}`);

  try {
    const stats = await importHarvestRevenue(filePath);
    console.log(`Rows read     : ${stats.read}`);
    console.log(`Inserted      : ${stats.inserted}`);
    console.log(`Updated       : ${stats.updated}`);
    console.log(`Unmatched     : ${stats.unmatched.length}`);
    stats.unmatched.forEach((row) => console.warn('  unmatched ->', row));
    if (stats.drift.length > 0) {
      console.warn(`Revenue drift : ${stats.drift.length} row(s) where sheet total != quantity * price`);
      stats.drift.forEach((row) => console.warn('  drift ->', row));
    }
  } catch (error) {
    console.error('Import failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

// Only run when invoked directly, so the importer stays reusable.
if (process.argv[1] && process.argv[1].endsWith('import_harvest_revenue.js')) {
  run();
}
