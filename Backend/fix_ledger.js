import { pool } from './db.js';

async function run() {
  const res = await pool.query(`
    SELECT sl.id, t.shift_id, sl.approved_progress
    FROM salary_ledger sl
    JOIN tasks t ON sl.task_id = t.id
    WHERE sl.amount = 0
  `);

  for (let row of res.rows) {
    if (row.shift_id) {
      const shiftRes = await pool.query('SELECT base_wage FROM shifts WHERE id = $1', [row.shift_id]);
      if (shiftRes.rows.length > 0) {
        const base_wage = shiftRes.rows[0].base_wage;
        const amount = (base_wage * (row.approved_progress / 100)).toFixed(2);
        await pool.query('UPDATE salary_ledger SET amount = $1 WHERE id = $2', [amount, row.id]);
        console.log(`Updated ledger entry ${row.id} to amount: Rs. ${amount}`);
      }
    }
  }
  process.exit(0);
}
run();
