import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';
import { calculateHarvestForCrop } from '../services/harvestService.js';
import { getWeatherSummary, getWeatherByCity, getTomorrowForecast, getTomorrowForecastByCity } from '../services/weatherService.js';
import { buildCropAdvice } from '../services/cropAdviceService.js';
import { generateCropWeatherAdvice } from '../services/openRouterService.js';

// GET /api/crops – list crop cycles for the user's farm
export async function getCrops(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    // Perennials keep bearing, so the UI needs how many times they have been
    // picked and when, not just a single actual_harvest_date.
    const result = await pool.query(
      `SELECT c.id, c.crop_name, c.variety, c.block_id, c.field_id, c.planting_date, c.expected_harvest_date,
              c.current_stage, c.status, c.expected_yield, c.yield_unit, c.notes, c.created_at,
              c.remaining_days, c.harvest_progress, c.harvest_status, c.is_historical, c.actual_harvest_date,
              COALESCE(m.is_perennial, FALSE) AS is_perennial,
              m.harvest_type,
              m.harvest_frequency,
              m.productive_life_years,
              COALESCE(h.harvest_count, 0)::int AS harvest_count,
              h.last_harvest_date
         FROM crop_cycles c
         LEFT JOIN crop_master m ON m.crop_name = c.crop_name
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS harvest_count, MAX(harvest_date) AS last_harvest_date
           FROM crop_harvests ch WHERE ch.crop_cycle_id = c.id
         ) h ON TRUE
        WHERE c.farm_id = $1
        ORDER BY c.created_at DESC`,
      [farmId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching crops:', err);
    res.status(500).json({ error: 'Failed to fetch crops', details: err.message });
  }
}

// POST /api/crops – add a new crop cycle
export async function addCrop(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const {
      crop_name,
      variety,
      block_id,
      field_id,
      planting_date,
      expected_harvest_date,
      season,
      expected_yield,
      yield_unit,
      notes
    } = req.body;
    if (!crop_name || !planting_date) {
      return res.status(400).json({ error: 'crop_name and planting_date are required' });
    }
    const result = await pool.query(
      `INSERT INTO crop_cycles (farm_id, block_id, field_id, crop_name, variety, planting_date, expected_harvest_date, season, expected_yield, yield_unit, notes, status)`
      + ` VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'planned') RETURNING *`,
      [
        farmId,
        block_id || null,
        field_id || null,
        crop_name,
        variety || null,
        planting_date,
        expected_harvest_date || null,
        season || null,
        expected_yield || null,
        yield_unit || null,
        notes || null
      ]
    );

    const newCropId = result.rows[0].id;
    // Auto-calculate harvest info based on crop_master and planting_date
    await calculateHarvestForCrop(newCropId);

    const updatedCropRes = await pool.query(`SELECT * FROM crop_cycles WHERE id = $1`, [newCropId]);
    
    res.status(201).json({ message: 'Crop created', crop: updatedCropRes.rows[0] });
  } catch (err) {
    console.error('Error adding crop:', err);
    res.status(500).json({ error: 'Failed to add crop', details: err.message });
  }
}

// DELETE /api/crops/:id â€“ delete a crop cycle for the user's farm
export async function deleteCrop(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM crop_cycles WHERE id = $1 AND farm_id = $2 RETURNING id`,
      [id, farmId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Crop not found' });
    }

    res.json({ message: 'Crop deleted', id: result.rows[0].id });
  } catch (err) {
    console.error('Error deleting crop:', err);
    res.status(500).json({ error: 'Failed to delete crop', details: err.message });
  }
}

// Weather-driven irrigation, harvest and planting guidance for today and
// tomorrow. Cached per farm so opening the Crops page does not fire a model
// call every time; the key includes the weather so it refreshes when
// conditions actually change.
const cropAdviceCache = new Map();
const CROP_ADVICE_TTL_MS = 60 * 60 * 1000;

export async function getCropWeatherAdvice(req, res) {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);
    const language = req.query.language || 'en';

    const farmRes = await pool.query('SELECT latitude, longitude FROM farms WHERE id = $1', [farmId]);
    const { latitude, longitude } = farmRes.rows[0] || {};

    let today = null;
    let tomorrow = null;
    if (latitude && longitude) {
      [today, tomorrow] = await Promise.all([
        getWeatherSummary(latitude, longitude),
        getTomorrowForecast(latitude, longitude),
      ]);
    }
    // Farms without coordinates still get advice, via the default city.
    const fallbackCity = process.env.DEFAULT_CITY || 'Vavuniya';
    if (!today) {
      today = await getWeatherByCity(fallbackCity);
    }
    if (!tomorrow) {
      tomorrow = await getTomorrowForecastByCity(fallbackCity);
    }
    if (!today) {
      return res.status(503).json({ error: 'Weather data is unavailable right now.' });
    }

    // Crops close enough to harvest that the weather changes what to do.
    const dueRes = await pool.query(
      `
        SELECT c.crop_name, c.variety, c.remaining_days, c.harvest_status, f.field_name
        FROM crop_cycles c
        LEFT JOIN farm_fields f ON f.id = c.field_id
        WHERE c.farm_id = $1
          AND COALESCE(c.is_historical, FALSE) = FALSE
          AND c.status NOT IN ('harvested', 'failed')
          AND (c.remaining_days IS NULL OR c.remaining_days <= 7)
        ORDER BY c.remaining_days ASC NULLS LAST
        LIMIT 8
      `,
      [farmId],
    );

    const dueCrops = dueRes.rows.map((row) => ({
      crop_name: row.crop_name,
      variety: row.variety,
      field: row.field_name,
      remaining_days: row.remaining_days,
      harvest_status: row.harvest_status,
    }));

    const todayAdvice = buildCropAdvice(today, null, dueCrops);
    const tomorrowAdvice = tomorrow ? buildCropAdvice(tomorrow, tomorrow.rain_mm, dueCrops) : null;

    const cacheKey = `${farmId}:${language}:${Math.round(today.temperature)}:${Math.round(today.humidity)}:${tomorrow?.date || 'none'}`;
    const cached = cropAdviceCache.get(cacheKey);
    let narrative = cached && Date.now() - cached.at < CROP_ADVICE_TTL_MS ? cached.value : null;

    if (!narrative) {
      narrative = await generateCropWeatherAdvice(
        { today_weather: today, tomorrow_weather: tomorrow, due_crops: dueCrops, today: todayAdvice, tomorrow: tomorrowAdvice },
        language,
      );
      if (narrative) cropAdviceCache.set(cacheKey, { at: Date.now(), value: narrative });
    }

    res.json({
      today: { weather: today, advice: todayAdvice },
      tomorrow: tomorrow ? { weather: tomorrow, advice: tomorrowAdvice } : null,
      due_crops: dueCrops,
      narrative,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to build crop weather advice:', error);
    res.status(500).json({ error: 'Failed to build crop advice.' });
  }
}
