import { pool } from './db.js';
pool.query("SELECT id, title, started_at, completed_at, updated_at FROM tasks WHERE title = 'irrigate to the tomato'").then(res => console.log(res.rows)).catch(console.error).finally(() => pool.end());
