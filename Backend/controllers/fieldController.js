import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';

// POST /api/fields
export async function addField(req, res) {
  try {
    const userId = req.user.userId;
    const resolvedFarmId = await getDefaultFarmId(userId);
    const { field_name, field_code, area, soil_type, irrigation_type, location, status } = req.body;
    
    if (!field_name) {
      return res.status(400).json({ error: 'field_name is required' });
    }
    
    const result = await pool.query(
      `INSERT INTO farm_fields (farm_id, field_name, field_code, area, soil_type, irrigation_type, location, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        resolvedFarmId, 
        field_name, 
        field_code || null, 
        area || null, 
        soil_type || null, 
        irrigation_type || null, 
        location || null, 
        status || 'Active'
      ]
    );
    res.status(201).json({ message: 'Field created', field: result.rows[0] });
  } catch (err) {
    console.error('Error adding field:', err);
    res.status(500).json({ error: 'Failed to add field', details: err.message });
  }
}

// GET /api/fields/farm/:farmId
// Note: We ignore the param farmId to enforce security via token if needed, or use it. We'll use getDefaultFarmId for safety if not provided, or just use the param if valid.
export async function getFieldsByFarm(req, res) {
  try {
    const userId = req.user.userId;
    // We will use resolvedFarmId to ensure the user has access to it
    const resolvedFarmId = await getDefaultFarmId(userId);
    
    // Fetch fields and their current crop cycle if any
    const query = `
      SELECT f.*, 
             c.crop_name, c.current_stage as growth_stage, c.status as crop_status
      FROM farm_fields f
      LEFT JOIN crop_cycles c ON c.field_id = f.id AND c.status IN ('planned', 'seeded', 'growing', 'harvesting')
      WHERE f.farm_id = $1
      ORDER BY f.created_at DESC
    `;
    const result = await pool.query(query, [resolvedFarmId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching fields:', err);
    res.status(500).json({ error: 'Failed to fetch fields', details: err.message });
  }
}

// GET /api/fields/:id
export async function getFieldDetails(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const resolvedFarmId = await getDefaultFarmId(userId);

    // 1. Get field details
    const fieldRes = await pool.query(`SELECT * FROM farm_fields WHERE id = $1 AND farm_id = $2`, [id, resolvedFarmId]);
    if (fieldRes.rowCount === 0) {
      return res.status(404).json({ error: 'Field not found' });
    }
    const field = fieldRes.rows[0];

    // 2. Get current crop cycle
    const currentCropRes = await pool.query(
      `SELECT * FROM crop_cycles WHERE field_id = $1 AND status IN ('planned', 'seeded', 'growing', 'harvesting') ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    // 3. Get previous crop history
    const historyRes = await pool.query(
      `SELECT * FROM crop_cycles WHERE field_id = $1 AND status IN ('harvested', 'failed') ORDER BY created_at DESC`,
      [id]
    );

    // 4. Get related tasks (with worker updates / assignment details if possible)
    const tasksRes = await pool.query(
      `SELECT t.*, u.full_name as assigned_worker_name 
       FROM tasks t
       LEFT JOIN app_users u ON t.assigned_to_user_id = u.id
       LEFT JOIN crop_cycles c ON t.crop_cycle_id = c.id
       WHERE t.field_id = $1 OR c.field_id = $1
       ORDER BY t.created_at DESC`,
      [id]
    );

    res.json({
      field,
      current_crop: currentCropRes.rows[0] || null,
      history: historyRes.rows,
      tasks: tasksRes.rows
    });
  } catch (err) {
    console.error('Error fetching field details:', err);
    res.status(500).json({ error: 'Failed to fetch field details', details: err.message });
  }
}

// PUT /api/fields/:id
export async function updateField(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const resolvedFarmId = await getDefaultFarmId(userId);
    const { field_name, field_code, area, soil_type, irrigation_type, location, status } = req.body;

    const result = await pool.query(
      `UPDATE farm_fields 
       SET field_name = COALESCE($1, field_name),
           field_code = COALESCE($2, field_code),
           area = COALESCE($3, area),
           soil_type = COALESCE($4, soil_type),
           irrigation_type = COALESCE($5, irrigation_type),
           location = COALESCE($6, location),
           status = COALESCE($7, status),
           updated_at = now()
       WHERE id = $8 AND farm_id = $9 RETURNING *`,
      [field_name, field_code, area, soil_type, irrigation_type, location, status, id, resolvedFarmId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Field not found or unauthorized' });
    }

    res.json({ message: 'Field updated', field: result.rows[0] });
  } catch (err) {
    console.error('Error updating field:', err);
    res.status(500).json({ error: 'Failed to update field', details: err.message });
  }
}

// DELETE /api/fields/:id
export async function deleteField(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const resolvedFarmId = await getDefaultFarmId(userId);

    const result = await pool.query(
      `DELETE FROM farm_fields WHERE id = $1 AND farm_id = $2 RETURNING *`,
      [id, resolvedFarmId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Field not found or unauthorized' });
    }

    res.json({ message: 'Field deleted successfully' });
  } catch (err) {
    console.error('Error deleting field:', err);
    res.status(500).json({ error: 'Failed to delete field', details: err.message });
  }
}

// PUT /api/fields/:id/assign-crop
export async function assignCropToField(req, res) {
  try {
    const { id } = req.params;
    const { crop_cycle_id } = req.body;
    const userId = req.user.userId;
    const resolvedFarmId = await getDefaultFarmId(userId);

    // Verify field exists and belongs to the farm
    const fieldRes = await pool.query('SELECT id FROM farm_fields WHERE id = $1 AND farm_id = $2', [id, resolvedFarmId]);
    if (fieldRes.rowCount === 0) {
      return res.status(404).json({ error: 'Field not found' });
    }

    // Update the crop cycle to link to the new field
    const updateRes = await pool.query(
      'UPDATE crop_cycles SET field_id = $1, updated_at = now() WHERE id = $2 AND farm_id = $3 RETURNING *',
      [id, crop_cycle_id, resolvedFarmId]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Crop cycle not found or unauthorized' });
    }

    res.json({ message: 'Crop assigned to field successfully', crop: updateRes.rows[0] });
  } catch (err) {
    console.error('Error assigning crop:', err);
    res.status(500).json({ error: 'Failed to assign crop to field', details: err.message });
  }
}
