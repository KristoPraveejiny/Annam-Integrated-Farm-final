import { pool } from '../db.js';

/**
 * Stores the report PDF handed to a worker along with a task.
 *
 * The assign-task form already collected an attachment URL and name, but there
 * was nowhere to put them - createTask never read the fields, so the manager's
 * report PDF was silently discarded and never reached the farmer.
 */
const sql = `
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;
`;

const run = async () => {
  try {
    await pool.query(sql);
    console.log('tasks.attachment_url / attachment_name ready.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
