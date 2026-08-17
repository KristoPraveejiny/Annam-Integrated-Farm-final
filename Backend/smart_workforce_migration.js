import { pool } from './db.js';

async function migrate() {
    console.log('Starting Smart Workforce Database Migration...');
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Alter tasks table
            await client.query(`
                ALTER TABLE tasks
                ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMP,
                ADD COLUMN IF NOT EXISTS submission_time TIMESTAMP,
                ADD COLUMN IF NOT EXISTS completion_notes TEXT;
            `);
            
            // Alter task status ENUM or VARCHAR
            await client.query(`
                ALTER TABLE tasks
                ALTER COLUMN status TYPE VARCHAR(255) USING status::varchar;
            `);
            
            // Alter attendance_records status
            await client.query(`
                ALTER TABLE attendance_records
                ALTER COLUMN status TYPE VARCHAR(255) USING status::varchar;
            `);

            // Alter task_attendances status
            await client.query(`
                ALTER TABLE task_attendances
                ALTER COLUMN status TYPE VARCHAR(255) USING status::varchar;
            `);

            // Create farm_workforce_settings
            await client.query(`
                CREATE TABLE IF NOT EXISTS farm_workforce_settings (
                    farm_id UUID PRIMARY KEY REFERENCES farms(id) ON DELETE CASCADE,
                    grace_period_hours INT DEFAULT 12,
                    reminder_interval_hours INT DEFAULT 4,
                    late_submission_penalty INT DEFAULT 10
                );
            `);
            
            await client.query('COMMIT');
            console.log('Migration successful.');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        pool.end();
    }
}

migrate();
