import { pool } from './db.js';
Promise.all([
  pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks'"),
  pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'crop_observations'")
]).then(([tasks, obs]) => {
  console.log('TASKS:', tasks.rows);
  console.log('OBSERVATIONS:', obs.rows);
  process.exit(0);
});
