import { pool } from '../db.js';

async function migrate() {
  console.log('Starting migration to create disease_reports table...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS disease_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
        farmer_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
        field_id UUID REFERENCES farm_fields(id) ON DELETE CASCADE,
        crop_id UUID REFERENCES crop_cycles(id) ON DELETE CASCADE,
        crop_name VARCHAR(100),
        field_name VARCHAR(100),
        title VARCHAR(255),
        description TEXT,
        severity VARCHAR(50),
        affected_plants INT,
        image_urls JSONB,
        status VARCHAR(50) DEFAULT 'Submitted',
        ai_detection_id UUID,
        manager_notes TEXT,
        reported_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        resolved_by UUID REFERENCES app_users(id) ON DELETE SET NULL
      );
    `);
    console.log('Successfully created disease_reports table.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();
