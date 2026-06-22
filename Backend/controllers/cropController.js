import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';

// GET /api/crops – list crop cycles for the user's farm
export async function getCrops(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const result = await pool.query(
      `SELECT id, crop_name, variety, block_id, field_id, planting_date, expected_harvest_date, status, expected_yield, yield_unit, notes, created_at`
      + ` FROM crop_cycles WHERE farm_id = $1 ORDER BY created_at DESC`,
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
    res.status(201).json({ message: 'Crop created', crop: result.rows[0] });
  } catch (err) {
    console.error('Error adding crop:', err);
    res.status(500).json({ error: 'Failed to add crop', details: err.message });
  }
}
