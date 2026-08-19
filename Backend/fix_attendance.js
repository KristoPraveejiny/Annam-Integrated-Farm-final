import { pool } from './db.js';

async function run() {
  try {
    // Find attendances that have 0% progress but have an approved task ledger entry
    const res = await pool.query(`
      SELECT sa.id, sa.shift_id, s.base_wage, 
             (SELECT MAX(sl.approved_progress) FROM salary_ledger sl JOIN tasks t ON sl.task_id = t.id WHERE t.shift_id = sa.shift_id AND sl.worker_id = sa.worker_id) as actual_progress
      FROM shift_attendances sa
      JOIN shifts s ON s.id = sa.shift_id
      WHERE sa.approved_completion_percentage = 0 OR sa.payable_wage = 0
    `);

    for (let row of res.rows) {
      if (row.actual_progress > 0 && row.base_wage > 0) {
        const payableWage = (Number(row.base_wage) * (Number(row.actual_progress) / 100)).toFixed(2);
        await pool.query(`
          UPDATE shift_attendances 
          SET approved_completion_percentage = $1, 
              full_shift_wage = $2, 
              payable_wage = $3 
          WHERE id = $4
        `, [row.actual_progress, row.base_wage, payableWage, row.id]);
        
        console.log(`Updated Shift Attendance ${row.id}: Progress=${row.actual_progress}%, PayableWage=${payableWage}`);
      }
    }
    console.log("Attendance repair complete.");
  } catch (err) {
    console.error("Error repairing attendance:", err);
  } finally {
    process.exit(0);
  }
}
run();
