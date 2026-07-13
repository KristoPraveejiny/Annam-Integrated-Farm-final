import { pool } from './db.js';

async function checkColumns() {
  const tables = ['attendance_records', 'task_attendances', 'monthly_salary_payments', 'task_updates', 'system_settings'];
  for (const t of tables) {
    const res = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}'`);
    console.log(t, res.rows);
  }
  pool.end();
}

checkColumns();
