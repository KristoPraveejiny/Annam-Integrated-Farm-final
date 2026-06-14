import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';

export async function getBlocks(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const result = await pool.query(
      `SELECT id, block_code, name, area_acres, soil_type, irrigation_type, status, created_at`
      + ` FROM farm_blocks WHERE farm_id = $1 ORDER BY created_at ASC`,
      [farmId]
    );
    // Transform for frontend consistency
    const blocks = result.rows.map(b => ({
      id: b.id,
      code: b.block_code,
      name: b.name,
      area: b.area_acres,
      soil: b.soil_type,
      irrigation: b.irrigation_type,
      status: b.status,
    }));
    res.json(blocks);
  } catch (err) {
    console.error('Error fetching blocks:', err);
    res.status(500).json({ error: 'Failed to fetch blocks', details: err.message });
  }
}
