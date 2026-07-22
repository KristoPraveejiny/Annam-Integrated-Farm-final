import { pool } from '../db.js';

const sql = `
-- Track wage and approved progress on tasks
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS task_wage NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_progress INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earned_salary NUMERIC(12,2) DEFAULT 0;

-- Track review status on individual updates
ALTER TABLE task_updates
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Waiting for Review',
  ADD COLUMN IF NOT EXISTS approved_progress INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manager_comment TEXT,
  ADD COLUMN IF NOT EXISTS linked_update_id UUID REFERENCES task_updates(id),
  ADD COLUMN IF NOT EXISTS verification_score_details JSONB,
  ADD COLUMN IF NOT EXISTS risk_level TEXT;

-- New Ledger Table
CREATE TABLE IF NOT EXISTS salary_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_update_id UUID REFERENCES task_updates(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  approved_progress INT NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Earned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

(async () => {
  try {
    await pool.query(sql);
    console.log('Migration for dynamic payroll completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();
