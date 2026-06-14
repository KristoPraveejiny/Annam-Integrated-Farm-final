import { pool } from '../db.js';
import { sendCropUpdatedEmail } from '../services/emailService.js';
import { getDefaultFarmId } from './livestockController.js';

export async function createCropObservation(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const {
      cropCycleId,
      growthStage,
      healthScore,
      moistureScore,
      pestRisk,
      notes
    } = req.body;

    if (!cropCycleId) {
      return res.status(400).json({ error: 'cropCycleId is required' });
    }

    // Verify crop cycle belongs to farm
    const checkCrop = await pool.query('SELECT * FROM crop_cycles WHERE id = $1 AND farm_id = $2', [cropCycleId, farmId]);
    if (checkCrop.rowCount === 0) {
      return res.status(404).json({ error: 'Crop cycle not found' });
    }
    const crop = checkCrop.rows[0];

    const result = await pool.query(`
      INSERT INTO crop_observations 
      (crop_cycle_id, observed_by_user_id, growth_stage, plant_health_score, moisture_score, pest_risk_score, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      cropCycleId,
      userId,
      growthStage || null,
      healthScore || null,
      moistureScore || null,
      pestRisk || null,
      notes || null
    ]);

    // Fetch user details and manager details for email
    const farmerRes = await pool.query('SELECT full_name FROM app_users WHERE id = $1', [userId]);
    const farmerName = farmerRes.rows[0]?.full_name || 'Unknown Farmer';

    // Find the farm manager (owner of the farm for simplicity, or we can look up 'farm_manager' role members)
    const farmRes = await pool.query('SELECT owner_user_id FROM farms WHERE id = $1', [farmId]);
    if (farmRes.rows.length > 0) {
      const managerId = farmRes.rows[0].owner_user_id;
      const managerRes = await pool.query('SELECT email FROM app_users WHERE id = $1', [managerId]);
      
      if (managerRes.rows.length > 0) {
        await sendCropUpdatedEmail(managerRes.rows[0].email, {
          farmerName,
          cropName: crop.crop_name,
          growthStage,
          healthScore,
          pestRisk,
          notes
        });

        // Add db notification
        await pool.query(`
          INSERT INTO notifications (user_id, farm_id, type, title, message, priority)
          VALUES ($1, $2, 'CROP_UPDATED', 'Crop Observation Updated', $3, 'normal')
        `, [managerId, farmId, `${farmerName} updated observation for ${crop.crop_name}.`]);
      }
    }

    res.status(201).json({ message: 'Crop observation added successfully', observation: result.rows[0] });
  } catch (err) {
    console.error('Error creating crop observation:', err);
    res.status(500).json({ error: 'Failed to create crop observation' });
  }
}

export async function getRecentObservations(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const result = await pool.query(`
      SELECT 
        o.id, o.growth_stage, o.plant_health_score, o.pest_risk_score, o.notes, o.observed_at,
        c.crop_name,
        u.full_name as farmer_name
      FROM crop_observations o
      JOIN crop_cycles c ON o.crop_cycle_id = c.id
      JOIN app_users u ON o.observed_by_user_id = u.id
      WHERE c.farm_id = $1
      ORDER BY o.observed_at DESC
      LIMIT 20
    `, [farmId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent observations:', err);
    res.status(500).json({ error: 'Failed to fetch observations' });
  }
}
