import { pool } from './db.js';
pool.query("SELECT id, created_at, progress_percentage FROM task_updates WHERE task_id = '77343a3c-3cb7-49bf-82fa-ddfe21c25bd4' ORDER BY created_at DESC").then(res => console.log(res.rows)).catch(console.error).finally(() => pool.end());
