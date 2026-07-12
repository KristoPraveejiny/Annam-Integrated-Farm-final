import { pool } from '../db.js';

async function createDiseaseDetectionHistoryTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS disease_detection_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      crop_name VARCHAR(100) NOT NULL,
      disease_name VARCHAR(255) NOT NULL,
      confidence FLOAT NOT NULL,
      uploaded_image VARCHAR(500) NOT NULL,
      weather_summary JSONB,
      ai_recommendation JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    console.log('Creating disease_detection_history table...');
    await pool.query(query);
    console.log('disease_detection_history table created successfully!');
  } catch (error) {
    console.error('Error creating disease_detection_history table:', error);
  } finally {
    pool.end();
  }
}

createDiseaseDetectionHistoryTable();
