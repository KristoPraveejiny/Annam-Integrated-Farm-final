import { pool } from './db.js';
pool.query("SELECT id, full_name as name FROM app_users WHERE role::text IN ('worker', 'farmer')")
  .then(res => { console.log(JSON.stringify(res.rows)); process.exit(0); })
  .catch(e => console.error(e));
