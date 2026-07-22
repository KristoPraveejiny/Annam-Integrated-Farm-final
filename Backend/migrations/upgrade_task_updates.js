import { pool } from '../db.js';

const sql = `
ALTER TABLE task_updates 
  ADD COLUMN IF NOT EXISTS activity_type VARCHAR(255),
  ADD COLUMN IF NOT EXISTS progress_percentage INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS device_info JSONB,
  ADD COLUMN IF NOT EXISTS network_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS update_number INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS activity_score INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_updates INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_percentage INT DEFAULT 0;

-- Optionally, create a table for manager review history
CREATE TABLE IF NOT EXISTS task_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
`;

(async () => {
  try {
    await pool.query(sql);
    console.log('Migration for enterprise task updates completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();
