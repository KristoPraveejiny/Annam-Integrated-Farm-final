import { pool } from './db.js';
pool.query("DELETE FROM shift_attendances WHERE id = '70e1dd9d-e8f7-4e18-80c5-33dcc7bee658'").then(res => console.log('Deleted')).catch(console.error).finally(() => pool.end());
