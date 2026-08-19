import { pool } from '../db.js';

async function main() {
  const dupes = await pool.query(`
    SELECT worker_id, date, shift_id, array_agg(id ORDER BY created_at ASC) AS ids
    FROM shift_attendances
    GROUP BY worker_id, date, shift_id
    HAVING COUNT(*) > 1
  `);

  console.log(`Found ${dupes.rows.length} duplicate (worker_id, date, shift_id) groups.`);

  let deletedTotal = 0;
  for (const row of dupes.rows) {
    const [, ...toDelete] = row.ids; // keep the oldest row
    if (toDelete.length === 0) continue;
    const res = await pool.query(`DELETE FROM shift_attendances WHERE id = ANY($1::uuid[])`, [toDelete]);
    deletedTotal += res.rowCount;
    console.log(`worker=${row.worker_id} date=${row.date} shift=${row.shift_id}: kept ${row.ids[0]}, deleted ${toDelete.length}`);
  }

  console.log(`Done. Deleted ${deletedTotal} duplicate row(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error('Dedupe failed:', err);
  process.exit(1);
});
