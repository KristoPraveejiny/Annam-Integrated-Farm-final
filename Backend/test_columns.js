import { pool } from './db.js';
async function run() {
    try {
        const res = await pool.query(`SELECT * FROM app_users LIMIT 1`);
        console.log(res.rows[0]);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
