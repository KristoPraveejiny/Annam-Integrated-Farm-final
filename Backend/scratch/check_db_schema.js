import { pool } from '../db.js';

async function checkSchema() {
  try {
    for (const tbl of ['salary_transactions', 'monthly_salary_payments', 'salary_advances']) {
      const r = await pool.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
        [tbl]
      );
      console.log(`\nTable: ${tbl}`);
      r.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    }
  } catch (err) {
    console.error('Error querying schema:', err);
  } finally {
    await pool.end();
  }
}

checkSchema();
