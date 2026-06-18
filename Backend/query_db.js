import { pool } from './db.js';

async function fix() {
  try {
    const farms = await pool.query("SELECT id FROM farms LIMIT 1");
    if (farms.rows.length === 0) return;
    const farmId = farms.rows[0].id;
    
    const users = await pool.query("SELECT id, role FROM app_users");
    for (const u of users.rows) {
      if (u.role === 'worker' || u.role === 'farm_manager') {
        const memRole = u.role === 'farm_manager' ? 'manager' : 'worker';
        await pool.query("INSERT INTO farm_memberships (farm_id, user_id, member_role, status) VALUES ($1, $2, $3, 'active') ON CONFLICT DO NOTHING", [farmId, u.id, memRole]);
      }
    }
    console.log("Fixed memberships!");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
fix();
