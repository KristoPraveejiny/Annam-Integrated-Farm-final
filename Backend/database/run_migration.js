import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const sqlFilePath = path.join(__dirname, 'marketplace_migration.sql');
  const sql = fs.readFileSync(sqlFilePath, 'utf8');

  try {
    console.log(`Executing migration...`);
    await pool.query(sql);
    console.log('Migration completed successfully.');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log(`Some parts already exist, ignoring error...`);
    } else {
      console.error(`Error executing migration:`, err.message);
      throw err;
    }
  }
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
