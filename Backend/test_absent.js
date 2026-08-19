import { pool } from './db.js';

async function run() {
  try {
    const res = await pool.query(`
      INSERT INTO shift_attendances (worker_id, date, shift_id, check_in_time, check_out_time, total_hours, shift_status, farm_id)
      VALUES ('565aa6ca-9d0f-4fcf-a7d7-2d927e0b72d1', '2026-08-11', 'f1b61e38-ca99-4a80-a4a9-cfc72dde99fb', NULL, NULL, 0, 'Absent', 'b914630d-55f0-4d54-9968-b3a2aa40626c')
      RETURNING *
    `);
    console.log("Inserted:", res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
