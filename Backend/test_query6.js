import { pool } from './db.js';
pool.query("UPDATE shift_attendances SET check_out_time = '2026-08-17T02:15:38.521Z' WHERE id = '8547ceae-4944-4df1-aca0-4c9e5a8823b8'").then(() => console.log('Fixed')).catch(console.error).finally(() => pool.end());
