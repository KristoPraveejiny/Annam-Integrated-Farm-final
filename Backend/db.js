import './loadEnv.js';
import { Pool } from 'pg';

const databaseConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      user: String(process.env.DB_USER || 'postgres'),
      password: String(process.env.DB_PASSWORD ?? ''),
      database: String(process.env.DB_NAME || ''),
    };

const pool = new Pool(databaseConfig);

export { pool };
