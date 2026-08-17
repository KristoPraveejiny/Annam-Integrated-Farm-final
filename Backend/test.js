import { pool } from './db.js';
(async () => {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'task_updates';");
  console.log(res.rows.map(r => r.column_name));
  process.exit(0);
})();
