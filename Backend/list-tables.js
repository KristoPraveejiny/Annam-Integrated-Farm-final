import { pool } from './db.js';
async function run() {
  const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log(res.rows);
  process.exit(0);
}
run();
