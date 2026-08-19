import { pool } from './db.js';
pool.query("SELECT * FROM shift_attendances ORDER BY date DESC LIMIT 10").then(res => console.log(res.rows)).catch(console.error).finally(() => pool.end());
