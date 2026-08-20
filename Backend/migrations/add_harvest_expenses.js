import { pool } from '../db.js';

async function migrate() {
  console.log('Starting migration to add expense columns to crop_harvests...');
  try {
    // Expense categories as recorded per harvest batch.
    await pool.query(`
      ALTER TABLE crop_harvests
        ADD COLUMN IF NOT EXISTS seed_cost      NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS fertilizer_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS pesticide_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS machinery_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS other_cost     NUMERIC(14,2) NOT NULL DEFAULT 0;
    `);

    // Generated columns may reference base columns only, never another generated
    // column, so net_profit restates the revenue expression rather than reusing it.
    await pool.query(`
      ALTER TABLE crop_harvests
        ADD COLUMN IF NOT EXISTS total_expenses NUMERIC(14,2)
          GENERATED ALWAYS AS (seed_cost + fertilizer_cost + pesticide_cost + machinery_cost + other_cost) STORED;
    `);

    await pool.query(`
      ALTER TABLE crop_harvests
        ADD COLUMN IF NOT EXISTS net_profit NUMERIC(14,2)
          GENERATED ALWAYS AS (
            (quantity * price_per_unit)
            - (seed_cost + fertilizer_cost + pesticide_cost + machinery_cost + other_cost)
          ) STORED;
    `);

    console.log('Successfully added expense columns to crop_harvests.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();
