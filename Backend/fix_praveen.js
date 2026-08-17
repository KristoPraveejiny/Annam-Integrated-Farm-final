import { pool } from './db.js';

async function fixData() {
  try {
    const shiftId = '099601bc-9eee-485d-b77a-27f91bc4838d';
    
    // Update shift attendances
    await pool.query(`
      UPDATE shift_attendances sa
      SET total_hours = 4.5, full_shift_wage = 1300.00, payable_wage = 650.00, approved_completion_percentage = 50, shift_status = 'Present'
      FROM app_users u
      WHERE sa.worker_id = u.id AND u.full_name = 'praveen' AND sa.shift_id = $1
    `, [shiftId]);

    console.log('Data fixed!');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

fixData();
