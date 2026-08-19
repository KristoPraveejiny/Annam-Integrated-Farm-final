import { pool } from './db.js';
pool.query("SELECT column_name, data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name = 'shift_attendances' AND column_name = 'total_hours'").then(res => console.log(res.rows)).catch(console.error).finally(() => pool.end());
