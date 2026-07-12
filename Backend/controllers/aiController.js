import { pool } from '../db.js';
import { detectDiseaseFromDjango } from '../services/djangoService.js';
import { getWeatherSummary, getWeatherByCity } from '../services/weatherService.js';
import { generateDiseaseRecommendations } from '../services/openRouterService.js';
import { getDefaultFarmId } from './livestockController.js';

export async function detectDisease(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imagePath = req.file.path;
    const originalName = req.file.originalname;
    
    const requestedCrop = req.body.crop || 'Tomato';

    // 1. Call Django AI for inference
    let aiResponse;
    try {
      aiResponse = await detectDiseaseFromDjango(imagePath, requestedCrop);
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Error communicating with AI service' });
    }

    const { crop, disease } = aiResponse;
    // Validate and clamp confidence to [0, 100], rounded to 2 decimal places
    const confidence = Math.round(Math.min(100, Math.max(0, Number(aiResponse.confidence))) * 100) / 100;

    // 2. Fetch farm lat/lon for weather
    const farmRes = await pool.query('SELECT latitude, longitude FROM farms WHERE id = $1', [farmId]);
    let weatherSummary = null;
    if (farmRes.rows.length > 0) {
      const { latitude, longitude } = farmRes.rows[0];
      if (latitude && longitude) {
        weatherSummary = await getWeatherSummary(latitude, longitude);
      }
    }
    
    // Fallback: If no farm coordinates, use default city weather
    if (!weatherSummary) {
      const defaultCity = process.env.DEFAULT_CITY || 'Vavuniya';
      weatherSummary = await getWeatherByCity(defaultCity);
    }

    // 3. Call OpenRouter for recommendations
    const language = req.body.language || 'en';
    const aiRecommendation = await generateDiseaseRecommendations(crop, disease, weatherSummary, confidence, language);

    // 4. Save to database
    // multer stores files in 'uploads/activities/'
    const dbImagePath = req.file.filename ? `/uploads/activities/${req.file.filename}` : originalName;

    const result = await pool.query(
      `INSERT INTO disease_detection_history 
      (user_id, farm_id, crop_name, disease_name, confidence, uploaded_image, weather_summary, ai_recommendation) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [userId, farmId, crop, disease, confidence, dbImagePath, JSON.stringify(weatherSummary), JSON.stringify(aiRecommendation)]
    );

    // Also store in the disease_detections table for farm management visibility
    let severity = 'Medium';
    if (confidence > 85) severity = 'High';
    else if (confidence < 60) severity = 'Low';

    await pool.query(
      `INSERT INTO disease_detections 
      (farm_id, detected_by_user_id, image_url, disease_name, severity, confidence, ai_model_version, recommendations, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        farmId, 
        userId, 
        dbImagePath, 
        disease, 
        severity, 
        confidence, 
        '1.0', 
        aiRecommendation.disease_explanation || '', 
        'Detected'
      ]
    );

    // 5. Return aggregated response
    return res.status(200).json({
      success: true,
      historyId: result.rows[0].id,
      crop,
      disease,
      confidence,
      weatherSummary,
      aiRecommendation,
      image_url: dbImagePath,
      created_at: result.rows[0].created_at
    });

  } catch (error) {
    console.error('Error in detectDisease:', error);
    res.status(500).json({ error: 'Internal server error during disease detection' });
  }
}

export async function getDiseaseHistory(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const result = await pool.query(
      `SELECT id, crop_name, disease_name, confidence, uploaded_image, weather_summary, ai_recommendation, created_at 
       FROM disease_detection_history 
       WHERE user_id = $1 AND farm_id = $2 
       ORDER BY created_at DESC`,
      [userId, farmId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching disease history:', error);
    res.status(500).json({ error: 'Failed to fetch disease history' });
  }
}
