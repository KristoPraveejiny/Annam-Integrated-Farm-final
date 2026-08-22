import { pool } from '../db.js';

/**
 * Worker leave requests, reviewed by the farm manager.
 *
 * Approved leave is also what the task assignment flow checks against, so a
 * worker cannot be given work on a day they are away.
 */
const sql = `
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  manager_notes TEXT,
  reviewed_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT leave_requests_date_order CHECK (end_date >= start_date),
  CONSTRAINT leave_requests_status_valid
    CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled'))
);

-- The assignment check looks up approved leave by worker and date range.
CREATE INDEX IF NOT EXISTS leave_requests_worker_dates_idx
  ON leave_requests (worker_id, start_date, end_date)
  WHERE status = 'Approved';

CREATE INDEX IF NOT EXISTS leave_requests_farm_status_idx
  ON leave_requests (farm_id, status);
`;

const run = async () => {
  try {
    await pool.query(sql);
    console.log('leave_requests table ready.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
