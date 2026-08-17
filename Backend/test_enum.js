import { pool } from './db.js';
async function run() {
    try {
        const res = await pool.query("SELECT unnest(enum_range(NULL::crop_status))");
        console.log(res.rows);
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
