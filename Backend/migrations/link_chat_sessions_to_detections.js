import { pool } from '../db.js';

/**
 * Ties a chat session to the disease detection it was opened from.
 *
 * Without this link, every visit from the Disease Detection page created a
 * fresh session, so asking a follow-up about the same scan lost the earlier
 * conversation and filled the sidebar with duplicates.
 */
const sql = `
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS detection_id UUID
  REFERENCES disease_detection_history(id) ON DELETE SET NULL;

-- One session per detection per user; the lookup runs on every visit.
CREATE UNIQUE INDEX IF NOT EXISTS chat_sessions_user_detection_idx
  ON chat_sessions (user_id, detection_id)
  WHERE detection_id IS NOT NULL;
`;

const run = async () => {
  try {
    await pool.query(sql);
    console.log('chat_sessions.detection_id ready.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
