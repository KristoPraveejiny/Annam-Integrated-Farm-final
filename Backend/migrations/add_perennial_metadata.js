import { pool } from '../db.js';

// Perennials keep bearing after each harvest; seasonal crops are removed once
// picked. Figures from perennial_crops_harvests.xlsx.
const CROP_PROFILES = [
  { crop: 'Papaya',        perennial: true,  type: 'continuous', firstHarvest: 320,  frequency: 30,  life: 3 },
  { crop: 'Lemon',         perennial: true,  type: 'annual',     firstHarvest: 1095, frequency: 365, life: 18 },
  { crop: 'Mango',         perennial: true,  type: 'seasonal',   firstHarvest: 1460, frequency: 365, life: 30 },
  { crop: 'Coconut',       perennial: true,  type: 'continuous', firstHarvest: 1825, frequency: 52,  life: 60 },
  { crop: 'Paddy',         perennial: false, type: 'seasonal' },
  { crop: 'Tomato',        perennial: false, type: 'seasonal' },
  { crop: 'Brinjal',       perennial: false, type: 'seasonal' },
  { crop: 'Beans',         perennial: false, type: 'seasonal' },
  { crop: 'Ladies Finger', perennial: false, type: 'seasonal' },
  { crop: 'Corn',          perennial: false, type: 'seasonal' },
  { crop: 'Green Chilli',  perennial: false, type: 'seasonal' },
  { crop: 'Turmeric',      perennial: false, type: 'seasonal' },
];

async function migrate() {
  console.log('Starting migration to add perennial metadata to crop_master...');
  try {
    // harvest_type, first_harvest_duration and harvest_frequency were declared
    // when the table was created but never populated or read by anything.
    await pool.query(`
      ALTER TABLE crop_master
        ADD COLUMN IF NOT EXISTS is_perennial BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS productive_life_years INTEGER;
    `);

    for (const profile of CROP_PROFILES) {
      await pool.query(`
        UPDATE crop_master
        SET is_perennial = $2,
            harvest_type = $3,
            first_harvest_duration = $4,
            harvest_frequency = $5,
            productive_life_years = $6
        WHERE crop_name = $1
      `, [
        profile.crop,
        profile.perennial,
        profile.type,
        profile.firstHarvest ?? null,
        profile.frequency ?? null,
        profile.life ?? null,
      ]);
    }

    const check = await pool.query(`
      SELECT crop_name, is_perennial, harvest_type, first_harvest_duration, harvest_frequency, productive_life_years
      FROM crop_master ORDER BY is_perennial DESC, crop_name
    `);
    console.table(check.rows);
    console.log('Successfully added perennial metadata.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();
