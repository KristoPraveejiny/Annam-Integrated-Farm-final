import { pool } from './db.js';
async function run() {
  const t1 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'disease_detection_history'");
  const t2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks'");
  const t3 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'salary_ledger'");
  const t4 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'disease_reports'");
  
  console.log("disease_detection_history:", t1.rows);
  console.log("tasks:", t2.rows);
  console.log("salary_ledger:", t3.rows);
  console.log("disease_reports:", t4.rows);
  process.exit(0);
}
run();
