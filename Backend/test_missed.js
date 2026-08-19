import { pool } from './db.js';
async function run() {
  const res = await pool.query(`
    SELECT id, title, completed_at, updated_at
    FROM tasks
    WHERE title = 'irrigate to the farm'
  `);
  console.log(res.rows);
  process.exit(0);
}
run();
