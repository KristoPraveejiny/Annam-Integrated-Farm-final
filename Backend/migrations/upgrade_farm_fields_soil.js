import { pool } from '../db.js';

async function migrate() {
  console.log('Starting migration for farm_fields soil information...');
  try {
    await pool.query(`
      ALTER TABLE farm_fields 
      ADD COLUMN IF NOT EXISTS soil_ph NUMERIC(3, 1),
      ADD COLUMN IF NOT EXISTS soil_fertility_level VARCHAR(50),
      ADD COLUMN IF NOT EXISTS drainage_quality VARCHAR(50);
    `);
    console.log('Successfully added soil_ph, soil_fertility_level, and drainage_quality to farm_fields table.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();
