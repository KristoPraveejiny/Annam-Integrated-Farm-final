import { pool } from './db.js';

async function testInsert() {
    try {
        const result = await pool.query(
            'INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING *',
            ['011aea3a-56a6-4754-b36e-863043dbc22a', 'Test']
        );
        console.log("Insert success:", result.rows);
    } catch(err) {
        console.error("Insert failed:", err.message);
    }
    
    try {
        const getRes = await pool.query('SELECT * FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC', ['011aea3a-56a6-4754-b36e-863043dbc22a']);
        console.log("Get success:", getRes.rows);
    } catch(err) {
        console.error("Get failed:", err.message);
    }
    process.exit(0);
}
testInsert();
