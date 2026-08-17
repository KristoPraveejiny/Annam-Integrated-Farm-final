import { pool } from './db.js';

const setupHarvestTables = async () => {
    try {
        console.log('Starting harvest tables setup...');

        // 1. Create crop_master table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crop_master (
                id SERIAL PRIMARY KEY,
                crop_name VARCHAR(255) NOT NULL UNIQUE,
                average_growth_period INTEGER NOT NULL, -- in days
                harvest_type VARCHAR(100),
                first_harvest_duration INTEGER,
                harvest_frequency INTEGER,
                default_status_progression JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('crop_master table created or exists.');

        // 2. Extend crop_cycles table
        const addColumnIfNotExists = async (tableName, columnName, dataType) => {
            const checkQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='${tableName}' AND column_name='${columnName}';
            `;
            const res = await pool.query(checkQuery);
            if (res.rowCount === 0) {
                await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${dataType};`);
                console.log(`Added column ${columnName} to ${tableName}`);
            } else {
                console.log(`Column ${columnName} already exists in ${tableName}`);
            }
        };

        await addColumnIfNotExists('crop_cycles', 'expected_harvest_date', 'DATE');
        await addColumnIfNotExists('crop_cycles', 'remaining_days', 'INTEGER');
        await addColumnIfNotExists('crop_cycles', 'harvest_progress', 'INTEGER DEFAULT 0');
        await addColumnIfNotExists('crop_cycles', 'harvest_status', 'VARCHAR(50)');

        // 3. Seed crop_master
        const defaultCrops = [
            { name: 'Tomato', period: 90 },
            { name: 'Beans', period: 60 },
            { name: 'Papaya', period: 270 },
            { name: 'Mango', period: 1095 },
            { name: 'Brinjal', period: 100 },
            { name: 'Coconut', period: 1825 },
            { name: 'Paddy', period: 120 },
            { name: 'Corn', period: 100 },
            { name: 'Green Chilli', period: 90 },
            { name: 'Ladies Finger', period: 60 },
            { name: 'Lemon', period: 1095 },
            { name: 'Turmeric', period: 270 }
        ];

        const defaultProgression = JSON.stringify([
            { stage: 'Recently Planted', days_offset: 0 },
            { stage: 'Growing', days_offset: 0.2 },
            { stage: 'Flowering', days_offset: 0.5 },
            { stage: 'Fruiting', days_offset: 0.75 },
            { stage: 'Ready for Harvest', days_offset: 1.0 }
        ]);

        for (const crop of defaultCrops) {
            await pool.query(`
                INSERT INTO crop_master (crop_name, average_growth_period, default_status_progression)
                VALUES ($1, $2, $3)
                ON CONFLICT (crop_name) DO UPDATE 
                SET average_growth_period = EXCLUDED.average_growth_period,
                    default_status_progression = EXCLUDED.default_status_progression;
            `, [crop.name, crop.period, defaultProgression]);
        }
        console.log('Seeded crop_master with default crops.');

        console.log('Harvest tables setup completed successfully.');
    } catch (error) {
        console.error('Error setting up harvest tables:', error);
    } finally {
        pool.end();
    }
};

setupHarvestTables();
