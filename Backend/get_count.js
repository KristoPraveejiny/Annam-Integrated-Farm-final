import { pool } from './db.js';
pool.query('SELECT COUNT(*) FROM disease_detection_history').then(res => {
  console.log('disease_detection_history count:', res.rows[0].count);
  process.exit(0);
});
