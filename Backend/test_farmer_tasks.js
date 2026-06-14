import { pool } from './db.js';

(async () => {
  try {
    const res = await pool.query(`
      SELECT t.*, c.crop_name, c.variety
      FROM tasks t
      LEFT JOIN crop_cycles c ON t.crop_cycle_id = c.id
      WHERE t.farm_id = 'b914630d-55f0-4d54-9968-b3a2aa40626c' AND t.assigned_to_user_id = '565aa6ca-9d0f-4fcf-a7d7-2d927e0b72d1'
    `);
    console.table(res.rows);
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
})();
