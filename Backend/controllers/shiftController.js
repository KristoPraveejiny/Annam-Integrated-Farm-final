import { pool } from '../db.js';

// Get all shifts for a farm
export const getShifts = async (req, res) => {
  try {
    const farmId = req.user.farmId; // Assuming req.user has farmId from auth middleware
    const result = await pool.query(
      'SELECT * FROM shifts WHERE farm_id = $1 ORDER BY start_time ASC',
      [farmId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching shifts:', err);
    res.status(500).json({ error: 'Server error fetching shifts' });
  }
};

// Create a new shift
export const createShift = async (req, res) => {
  try {
    const farmId = req.user.farmId;
    const {
      shift_name, start_time, end_time, standard_hours,
      base_wage, hourly_rate, overtime_rate, holiday_rate, weekend_rate
    } = req.body;

    const result = await pool.query(
      `INSERT INTO shifts (
        farm_id, shift_name, start_time, end_time, standard_hours, 
        base_wage, hourly_rate, overtime_rate, holiday_rate, weekend_rate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        farmId, shift_name, start_time, end_time, standard_hours,
        base_wage || 0, hourly_rate || 0, overtime_rate || 0, holiday_rate || 0, weekend_rate || 0
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating shift:', err);
    res.status(500).json({ error: 'Server error creating shift' });
  }
};

// Update an existing shift
export const updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      shift_name, start_time, end_time, standard_hours,
      base_wage, hourly_rate, overtime_rate, holiday_rate, weekend_rate, is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE shifts SET 
        shift_name = $1, start_time = $2, end_time = $3, standard_hours = $4,
        base_wage = $5, hourly_rate = $6, overtime_rate = $7, holiday_rate = $8, 
        weekend_rate = $9, is_active = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 RETURNING *`,
      [
        shift_name, start_time, end_time, standard_hours,
        base_wage, hourly_rate, overtime_rate, holiday_rate, weekend_rate, is_active,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating shift:', err);
    res.status(500).json({ error: 'Server error updating shift' });
  }
};

// Delete a shift
export const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM shifts WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    
    res.json({ message: 'Shift deleted successfully' });
  } catch (err) {
    console.error('Error deleting shift:', err);
    res.status(500).json({ error: 'Server error deleting shift' });
  }
};
