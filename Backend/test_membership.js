import { pool } from './db.js';

(async () => {
  try {
    const res = await pool.query("SELECT * FROM farm_memberships WHERE user_id='565aa6ca-9d0f-4fcf-a7d7-2d927e0b72d1'");
    console.table(res.rows);
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
})();
