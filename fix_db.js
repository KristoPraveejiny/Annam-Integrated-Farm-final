import { pool } from './Backend/db.js';

async function fix() {
  try {
    const res = await pool.query("UPDATE tasks SET status = 'In Progress' WHERE (status = 'Completed' OR status = 'Done' OR status = 'Waiting Manager Approval') AND (completion_percentage < 100 OR completion_percentage IS NULL)");
    console.log(`Updated ${res.rowCount} tasks`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

fix();
