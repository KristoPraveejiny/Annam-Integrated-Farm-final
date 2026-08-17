import { pool } from './db.js';
async function run() {
  await pool.query("UPDATE tasks SET status = 'Pending' WHERE status = 'missed_shift'");
  console.log('Fixed statuses');
  process.exit(0);
}
run().catch(console.error);
