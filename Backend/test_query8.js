import { pool } from './db.js';
pool.query("SELECT * FROM shift_attendances WHERE date = '2026-08-15'").then(res => console.log(res.rows)).catch(console.error).finally(() => pool.end());
