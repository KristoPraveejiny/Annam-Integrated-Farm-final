import { pool } from '../db.js';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Adding verification fields to tasks table...');
    await client.query(`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS verification_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS suspicious_flags JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS needs_manager_review BOOLEAN DEFAULT false
    `);

    console.log('Adding verification fields to task_updates table...');
    await client.query(`
      ALTER TABLE task_updates 
      ADD COLUMN IF NOT EXISTS image_hashes JSONB DEFAULT '[]'::jsonb
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
