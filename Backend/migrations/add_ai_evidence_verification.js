import { pool } from '../db.js';

const sql = `
ALTER TABLE task_updates 
  ADD COLUMN IF NOT EXISTS similarity_score INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS similarity_badge VARCHAR(50) DEFAULT '🟢 Different Image',
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS progress_detected VARCHAR(50) DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS evidence_quality VARCHAR(50) DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS quality_issues JSONB DEFAULT '[]'::jsonb;
`;

(async () => {
  try {
    await pool.query(sql);
    console.log('Migration for AI Evidence Verification completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();
