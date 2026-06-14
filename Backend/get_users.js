import { pool } from './db.js';

(async () => {
  try {
    const res = await pool.query("SELECT id, email, full_name, role FROM app_users");
    console.table(res.rows);
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
})();
