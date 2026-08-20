import { pool } from '../db.js';

async function migrate() {
  console.log('Adding recorded_by to crop_harvests...');
  try {
    // Farmers record perennial harvests from their own dashboard, so the
    // manager needs to see who logged each pick.
    await pool.query(`
      ALTER TABLE crop_harvests
        ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ;
    `);
    console.log('Successfully added recorded_by / recorded_at.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();
