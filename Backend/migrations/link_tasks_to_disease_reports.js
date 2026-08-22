import { pool } from '../db.js';

/**
 * Ties a task to the disease report it was raised from.
 *
 * The assign-task flow previously carried only a title and a description
 * string, so the worker receiving the task could not see what was actually
 * reported - the symptoms, severity, or the photo the farmer uploaded.
 */
const sql = `
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS disease_report_id UUID
  REFERENCES disease_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_disease_report_idx
  ON tasks (disease_report_id)
  WHERE disease_report_id IS NOT NULL;
`;

const run = async () => {
  try {
    await pool.query(sql);
    console.log('tasks.disease_report_id ready.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
