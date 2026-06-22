import { pool } from './db.js';

async function checkTables() {
    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('farm_fields', 'farm_blocks', 'crop_cycles', 'tasks');
        `);
        console.log('Tables found:', res.rows.map(row => row.table_name));
        
        // Also check columns in farm_fields if it exists
        if (res.rows.some(r => r.table_name === 'farm_fields')) {
            const cols = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'farm_fields';
            `);
            console.log('farm_fields columns:', cols.rows);
        }

        // Check columns in crop_cycles
        if (res.rows.some(r => r.table_name === 'crop_cycles')) {
            const cols = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'crop_cycles';
            `);
            console.log('crop_cycles columns:', cols.rows);
        }

        // Check columns in tasks
        if (res.rows.some(r => r.table_name === 'tasks')) {
            const cols = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'tasks';
            `);
            console.log('tasks columns:', cols.rows);
        }
        
    } catch (err) {
        console.error('Error checking tables:', err);
    } finally {
        pool.end();
    }
}

checkTables();
