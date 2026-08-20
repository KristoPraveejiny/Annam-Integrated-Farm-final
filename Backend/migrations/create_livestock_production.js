import { pool } from '../db.js';

async function migrate() {
  console.log('Creating livestock_production table...');
  try {
    // Livestock yield (milk, eggs, meat...) is recorded per group on the day it
    // is collected, mirroring how crop_harvests records a crop pick.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS livestock_production (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
        group_id        UUID REFERENCES livestock_groups(id) ON DELETE SET NULL,
        animal_id       UUID REFERENCES livestock_animals(id) ON DELETE SET NULL,
        species         TEXT,
        product_type    TEXT NOT NULL,
        production_date DATE NOT NULL,
        quantity        NUMERIC(14,3) NOT NULL DEFAULT 0,
        unit            TEXT NOT NULL DEFAULT 'litre',
        price_per_unit  NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_value     NUMERIC(14,2) GENERATED ALWAYS AS (quantity * price_per_unit) STORED,
        currency        CHAR(3) NOT NULL DEFAULT 'LKR',
        notes           TEXT,
        recorded_by     UUID REFERENCES app_users(id) ON DELETE SET NULL,
        recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_livestock_production_farm_date ON livestock_production(farm_id, production_date);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_livestock_production_group ON livestock_production(group_id, production_date);`);

    console.log('Successfully created livestock_production table.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();
