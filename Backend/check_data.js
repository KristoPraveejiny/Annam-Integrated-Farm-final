import { pool } from './db.js';

async function checkData() {
    try {
        const fields = await pool.query(`SELECT * FROM farm_fields`);
        console.log('Farm Fields:', fields.rows);
        
        const crops = await pool.query(`SELECT id, crop_name, field_id, block_id FROM crop_cycles`);
        console.log('Crops:', crops.rows);
        
        const tasks = await pool.query(`SELECT id, title, field_id FROM tasks`);
        console.log('Tasks:', tasks.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkData();
