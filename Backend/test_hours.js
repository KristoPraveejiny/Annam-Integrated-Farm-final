const { pool } = require('./db.js');
pool.query('SELECT sa.id, sa.check_in_time, sa.check_out_time, EXTRACT(EPOCH FROM (sa.check_out_time - sa.check_in_time))/3600 as raw_hours, ROUND((EXTRACT(EPOCH FROM (sa.check_out_time - sa.check_in_time))/3600)::numeric, 2) as rounded_hours FROM shift_attendances sa LIMIT 5')
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => pool.end());
