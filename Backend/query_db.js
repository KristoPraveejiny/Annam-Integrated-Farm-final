const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:Kristo%4018@localhost:5432/annam_integrated_farm' });

async function run() {
  try {
    const res1 = await pool.query("SELECT id, title, status, completion_percentage, updated_at FROM tasks WHERE title = 'irrigate to the farm' ORDER BY updated_at DESC LIMIT 5");
    console.log('Tasks:', res1.rows);
    
    const res2 = await pool.query("SELECT task_id, progress_percentage, is_final, status, created_at FROM task_updates ORDER BY created_at DESC LIMIT 5");
    console.log('Updates:', res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
