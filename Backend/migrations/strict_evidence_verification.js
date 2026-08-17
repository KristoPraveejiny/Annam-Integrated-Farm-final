import { pool } from '../db.js';

const sql = `
CREATE TABLE IF NOT EXISTS image_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  update_id INT, -- referencing task_updates update_number or a unique id, but task_updates uses composite typically or we can just omit strict fk for now
  original_file_name VARCHAR(255),
  stored_file_name VARCHAR(255),
  sha256_hash VARCHAR(255),
  phash VARCHAR(255),
  file_size INT,
  resolution VARCHAR(50),
  mime_type VARCHAR(50),
  upload_time TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_hashes_sha256 ON image_hashes(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_image_hashes_phash ON image_hashes(phash);

CREATE TABLE IF NOT EXISTS verification_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action VARCHAR(255) NOT NULL,
  performed_by UUID, -- Can be null for system actions
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE task_updates 
  ADD COLUMN IF NOT EXISTS verification_score INT,
  ADD COLUMN IF NOT EXISTS risk_level VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ai_confidence INT,
  ADD COLUMN IF NOT EXISTS verification_result VARCHAR(255),
  ADD COLUMN IF NOT EXISTS ai_explanation TEXT,
  ADD COLUMN IF NOT EXISTS fraud_summary JSONB,
  ADD COLUMN IF NOT EXISTS evidence_completeness JSONB,
  ADD COLUMN IF NOT EXISTS rework_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

CREATE TABLE IF NOT EXISTS system_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  setting_key VARCHAR(255) NOT NULL,
  setting_value JSONB,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(farm_id, setting_key)
);
`;

(async () => {
  try {
    await pool.query(sql);
    console.log('Migration for Strict Evidence Verification completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();
