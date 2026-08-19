import { pool } from './db.js';
pool.query("SELECT id, started_at, completed_at, updated_at FROM tasks WHERE id = (SELECT task_id FROM task_updates WHERE update_number > 0 LIMIT 1)").then(res => console.log(res.rows)).catch(console.error).finally(() => pool.end());
