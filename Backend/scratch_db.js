import { pool } from './db.js';

async function run() {
  try {
    const res = await pool.query('SELECT dr.id, dr.farmer_id, dr.title, u.full_name as farmer_name FROM disease_reports dr LEFT JOIN app_users u ON dr.farmer_id = u.id');
    console.table(res.rows);
    
    const users = await pool.query('SELECT id, full_name, email, role FROM app_users');
    console.table(users.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
