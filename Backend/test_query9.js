import { pool } from './db.js';
pool.query("DELETE FROM shift_attendances WHERE id = '300a0d75-4451-46d9-95da-0199a641497b'").then(res => console.log('Deleted')).catch(console.error).finally(() => pool.end());
