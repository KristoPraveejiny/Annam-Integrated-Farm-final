import { pool } from './db.js';
pool.query("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'disease_detections';")
  .then(res => { console.log(res.rows); process.exit(0); })
  .catch(console.error);
