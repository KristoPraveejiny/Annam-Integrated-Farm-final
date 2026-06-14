const { pool } = require('./db.js');
pool.query("SELECT id, full_name as name FROM app_users WHERE LOWER(role) IN ('worker', 'farmer')")
  .then(res => { console.log(res.rows); process.exit(0); })
  .catch(e => console.error(e));
