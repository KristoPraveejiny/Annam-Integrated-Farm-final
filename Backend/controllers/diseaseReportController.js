import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js'; // Helper for getting user's farm
import { sendDiseaseReportEmail } from '../services/emailService.js';

export async function createReport(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const { field_id, crop_id, title, description, severity, affected_plants } = req.body;

    let final_image_urls = [];
    if (req.file) {
      final_image_urls.push(`/uploads/activities/${req.file.filename}`);
    } else if (req.body.image_urls) {
      try {
        final_image_urls = typeof req.body.image_urls === 'string' ? JSON.parse(req.body.image_urls) : req.body.image_urls;
      } catch (e) {
        final_image_urls = [req.body.image_urls];
      }
    }

    // Fetch field and crop names
    const fieldRes = await pool.query('SELECT field_name FROM farm_fields WHERE id = $1', [field_id]);
    const field_name = fieldRes.rows[0]?.field_name || 'Unknown Field';

    const cropRes = await pool.query('SELECT crop_name FROM crop_cycles WHERE id = $1', [crop_id]);
    const crop_name = cropRes.rows[0]?.crop_name || 'Unknown Crop';

    const result = await pool.query(`
      INSERT INTO disease_reports 
      (farm_id, farmer_id, field_id, crop_id, crop_name, field_name, title, description, severity, affected_plants, image_urls, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Submitted')
      RETURNING *
    `, [
      farmId,
      userId,
      field_id,
      crop_id,
      crop_name,
      field_name,
      title,
      description,
      severity,
      affected_plants ? parseInt(affected_plants) : null,
      JSON.stringify(final_image_urls)
    ]);

    const report = result.rows[0];

    // Notification to farm manager
    const farmRes = await pool.query('SELECT owner_user_id FROM farms WHERE id = $1', [farmId]);
    if (farmRes.rows.length > 0) {
      const managerId = farmRes.rows[0].owner_user_id;
      const farmerRes = await pool.query('SELECT full_name FROM app_users WHERE id = $1', [userId]);
      const farmerName = farmerRes.rows[0]?.full_name || 'A farmer';
      
      const priority = severity === 'High' || severity === 'Emergency' ? 'high' : 'normal';

      await pool.query(`
        INSERT INTO notifications (user_id, farm_id, type, title, message, priority)
        VALUES ($1, $2, 'DISEASE_REPORT', 'New Disease Report Submitted', $3, $4)
      `, [managerId, farmId, `${farmerName} reported a ${severity.toLowerCase()} severity issue in ${field_name} (${crop_name}).`, priority]);

      // Send email to farm manager
      const managerRes = await pool.query('SELECT email FROM app_users WHERE id = $1', [managerId]);
      if (managerRes.rows.length > 0 && managerRes.rows[0].email) {
        await sendDiseaseReportEmail(managerRes.rows[0].email, {
          farmerName,
          cropName: crop_name,
          fieldName: field_name,
          severity,
          affectedPlants: affected_plants,
          title,
          description,
          imageUrl: final_image_urls.length > 0 ? final_image_urls[0] : null
        });
      }
    }

    res.status(201).json({ message: 'Disease report created successfully', report });
  } catch (err) {
    console.error('Error creating disease report:', err);
    res.status(500).json({ error: 'Failed to create disease report' });
  }
}

export async function getReports(req, res) {
  try {
    const userId = req.user.userId;
    const { role } = req.user; 
    const farmId = await getDefaultFarmId(userId);

    let query = `
      SELECT dr.*, u.full_name as farmer_name 
      FROM disease_reports dr
      JOIN app_users u ON dr.farmer_id = u.id
      WHERE dr.farm_id = $1
    `;
    const params = [farmId];

    // If farmer, only show their reports
    if (role === 'farmer' || role === 'worker') {
      query += ` AND dr.farmer_id = $2`;
      params.push(userId);
    }

    query += ` ORDER BY dr.reported_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching disease reports:', err);
    res.status(500).json({ error: 'Failed to fetch disease reports' });
  }
}

export async function getReportById(req, res) {
  try {
    const { id } = req.params;
    const farmId = await getDefaultFarmId(req.user.userId);

    const result = await pool.query(`
      SELECT dr.*, u.full_name as farmer_name 
      FROM disease_reports dr
      JOIN app_users u ON dr.farmer_id = u.id
      WHERE dr.id = $1 AND dr.farm_id = $2
    `, [id, farmId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching disease report by id:', err);
    res.status(500).json({ error: 'Failed to fetch report details' });
  }
}

export async function updateReportStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, manager_notes } = req.body;
    const userId = req.user.userId;

    const result = await pool.query(`
      UPDATE disease_reports
      SET status = COALESCE($1, status),
          manager_notes = COALESCE($2, manager_notes),
          resolved_at = CASE WHEN $1 = 'Resolved' THEN NOW() ELSE resolved_at END,
          resolved_by = CASE WHEN $1 = 'Resolved' THEN $3 ELSE resolved_by END
      WHERE id = $4
      RETURNING *
    `, [status, manager_notes, userId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = result.rows[0];

    // Notify farmer if status changed to Resolved
    if (status === 'Resolved') {
      await pool.query(`
        INSERT INTO notifications (user_id, farm_id, type, title, message, priority)
        VALUES ($1, $2, 'DISEASE_REPORT_RESOLVED', 'Disease Report Resolved', $3, 'normal')
      `, [report.farmer_id, report.farm_id, `Your disease report for ${report.crop_name} in ${report.field_name} has been marked as resolved.`]);
    }

    res.json({ message: 'Report updated successfully', report });
  } catch (err) {
    console.error('Error updating disease report:', err);
    res.status(500).json({ error: 'Failed to update report' });
  }
}

export async function saveAIResult(req, res) {
  try {
    const { id } = req.params;
    const { disease_name, confidence, recommendation, manager_notes, ai_detection_id } = req.body;

    const notesToSave = manager_notes 
      ? manager_notes + '\\n\\nAI Detection:\\n' + disease_name + ' (' + confidence + '%)' 
      : 'AI Detection:\\n' + disease_name + ' (' + confidence + '%)';

    const result = await pool.query(`
      UPDATE disease_reports
      SET status = 'Treatment Saved',
          manager_notes = $1,
          ai_detection_id = $2
      WHERE id = $3
      RETURNING *
    `, [notesToSave, ai_detection_id || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = result.rows[0];

    // Notify farmer
    await pool.query(`
        INSERT INTO notifications (user_id, farm_id, type, title, message, priority)
        VALUES ($1, $2, 'AI_ANALYSIS_COMPLETE', 'Disease AI Analysis Complete', $3, 'high')
      `, [report.farmer_id, report.farm_id, `Your disease report for ${report.crop_name} has been analyzed. Detected: ${disease_name}.`]);

    res.json({ message: 'AI result saved to report', report });
  } catch (err) {
    console.error('Error saving AI result to report:', err);
    res.status(500).json({ error: 'Failed to save AI result' });
  }
}

export async function checkDuplicates(req, res) {
  try {
    const { field_id, crop_id } = req.query;
    const farmId = await getDefaultFarmId(req.user.userId);

    const result = await pool.query(`
      SELECT id, status, reported_at FROM disease_reports
      WHERE farm_id = $1 AND field_id = $2 AND crop_id = $3
      AND status != 'Resolved'
      AND reported_at >= NOW() - INTERVAL '7 days'
      ORDER BY reported_at DESC
      LIMIT 1
    `, [farmId, field_id, crop_id]);

    if (result.rows.length > 0) {
      res.json({ duplicateExists: true, report: result.rows[0] });
    } else {
      res.json({ duplicateExists: false });
    }
  } catch (err) {
    console.error('Error checking duplicate reports:', err);
    res.status(500).json({ error: 'Failed to check duplicates' });
  }
}
