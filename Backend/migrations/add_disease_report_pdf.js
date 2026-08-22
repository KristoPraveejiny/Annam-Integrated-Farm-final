import { pool } from '../db.js';

/**
 * Stores the manager's PDF against the disease report itself.
 *
 * The review modal collected a PDF but only kept it as a browser blob URL, so
 * it vanished on close and the next open showed no record of it.
 */
const sql = `
ALTER TABLE disease_reports
  ADD COLUMN IF NOT EXISTS report_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS report_pdf_name TEXT;
`;

const run = async () => {
  try {
    await pool.query(sql);
    console.log('disease_reports.report_pdf_url / report_pdf_name ready.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
