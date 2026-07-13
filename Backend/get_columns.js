import { pool } from './db.js';
Promise.all([
  pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['disease_detections']),
  pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['disease_detection_history'])
]).then(([res1, res2]) => {
  console.log('disease_detections:', res1.rows.map(r => r.column_name));
  console.log('disease_detection_history:', res2.rows.map(r => r.column_name));
  process.exit(0);
});
