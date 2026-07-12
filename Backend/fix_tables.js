import { pool } from './db.js';

async function fixTables() {
    try {
        await pool.query('DROP TABLE IF EXISTS chat_messages CASCADE');
        await pool.query('DROP TABLE IF EXISTS chat_sessions CASCADE');
        console.log("Old tables dropped.");

        await pool.query(`
            CREATE TABLE chat_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("New chat_sessions created with UUID user_id.");

        await pool.query(`
            CREATE TABLE chat_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
                sender VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                image_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("New chat_messages created with content column.");

        process.exit(0);
    } catch(err) {
        console.error("Failed to fix tables:", err);
        process.exit(1);
    }
}
fixTables();
