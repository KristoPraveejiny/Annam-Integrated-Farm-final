import { pool } from './db.js';

pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'farms';")
  .then(res => console.log(res.rows.map(r => r.column_name)))
  .finally(() => pool.end());
