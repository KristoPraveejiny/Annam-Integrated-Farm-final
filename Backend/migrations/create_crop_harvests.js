import { pool } from '../db.js';

async function migrate() {
  console.log('Starting migration to create crop_harvests table...');
  try {
    // is_historical is read and written all over the backend but no committed
    // migration ever created it - it was added by hand against the live DB.
    await pool.query(`
      ALTER TABLE crop_cycles ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE;
    `);

    // A crop cycle can yield more than once (coconut, mango and other perennials),
    // so harvests live in their own table rather than as columns on crop_cycles.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crop_harvests (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        farm_id        UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
        crop_cycle_id  UUID REFERENCES crop_cycles(id) ON DELETE CASCADE,
        field_id       UUID REFERENCES farm_fields(id) ON DELETE SET NULL,
        crop_name      TEXT NOT NULL,
        variety        TEXT,
        harvest_date   DATE NOT NULL,
        quantity       NUMERIC(14,3) NOT NULL DEFAULT 0,
        unit           TEXT NOT NULL DEFAULT 'kg',
        price_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_revenue  NUMERIC(14,2) GENERATED ALWAYS AS (quantity * price_per_unit) STORED,
        currency       CHAR(3) NOT NULL DEFAULT 'LKR',
        notes          TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_crop_harvests_farm_date ON crop_harvests(farm_id, harvest_date);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_crop_harvests_crop ON crop_harvests(farm_id, crop_name);`);
    // Keeps the spreadsheet import re-runnable.
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_crop_harvests_cycle_date ON crop_harvests(crop_cycle_id, harvest_date);`);

    console.log('Successfully created crop_harvests table.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();
