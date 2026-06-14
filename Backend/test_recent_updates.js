import { pool } from './db.js';
import { getDefaultFarmId } from './controllers/livestockController.js';

(async () => {
  try {
    // Kristo's user ID is e2524f66-51f5-4282-a18b-6c5a0e327f01
    const userId = 'e2524f66-51f5-4282-a18b-6c5a0e327f01';
    const farmId = await getDefaultFarmId(userId);
    console.log("Farm ID for Kristo:", farmId);

    const query = `
      SELECT tu.id, tu.notes, tu.image_url, tu.created_at, t.title as task_title, u.full_name as farmer_name
      FROM task_updates tu
      JOIN tasks t ON tu.task_id = t.id
      JOIN app_users u ON tu.farmer_id = u.id
      WHERE t.farm_id = $1
      ORDER BY tu.created_at DESC
      LIMIT 10
    `;
    const result = await pool.query(query, [farmId]);
    console.table(result.rows);

    // Let's also just dump the raw task_updates table to see what's there
    console.log("Raw task_updates table:");
    const raw = await pool.query('SELECT * FROM task_updates');
    console.table(raw.rows);

    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
})();
