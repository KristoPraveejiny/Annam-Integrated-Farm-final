import { pool } from '../db.js';

const sql = `
CREATE TABLE IF NOT EXISTS task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
`;

(async () => {
  try {
    await pool.query(sql);
    console.log('task_updates table created/verified');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();
