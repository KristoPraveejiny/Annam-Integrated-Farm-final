import { pool } from './db.js';

async function setupMock() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS farm_fields (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
                field_name VARCHAR(100),
                field_code VARCHAR(50),
                area DECIMAL,
                soil_type VARCHAR(100),
                irrigation_type VARCHAR(100),
                location TEXT,
                status VARCHAR(20),
                created_at TIMESTAMP DEFAULT now(),
                updated_at TIMESTAMP DEFAULT now()
            );
            ALTER TABLE crop_cycles ADD COLUMN IF NOT EXISTS field_id UUID REFERENCES farm_fields(id) ON DELETE SET NULL;
            ALTER TABLE tasks ADD COLUMN IF NOT EXISTS field_id UUID REFERENCES farm_fields(id) ON DELETE SET NULL;
        `);
        console.log('Mock setup complete');
    } catch (err) {
        console.error('Error in mock setup:', err);
    } finally {
        pool.end();
    }
}

setupMock();
