import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';

async function ensureLivestockHealthEventsTable() {
  await pool.query(`
    ALTER TABLE livestock_health_events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'healthy';
    ALTER TABLE livestock_health_events ADD COLUMN IF NOT EXISTS image_url TEXT;
  `);
}

ensureLivestockHealthEventsTable().catch((error) => {
  console.error('Failed to ensure livestock_health_events table exists:', error);
});

export async function getLivestockHealthEvents(req, res) {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);
    const result = await pool.query(
      `
        SELECT h.id, h.animal_id AS "livestockId", a.tag_code AS "animalTag",
               h.event_type AS "healthIssue", h.notes AS "symptoms", h.diagnosis,
               h.treatment, h.medication AS "vaccinationDetails",
               h.event_date AS "eventDate", h.status, h.reported_by_user_id AS "updatedBy",
               h.image_url AS "imageUrl", h.updated_at AS "updatedAt", h.created_at AS "createdAt"
        FROM livestock_health_events h
        LEFT JOIN livestock_animals a ON a.id = h.animal_id
        WHERE h.farm_id = $1
        ORDER BY h.created_at DESC
      `,
      [farmId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch livestock health events:', error);
    res.status(500).json({ error: 'Failed to fetch livestock health events' });
  }
}

export async function createLivestockHealthEvent(req, res) {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);
    const {
      livestockId,
      healthIssue,
      symptoms,
      diagnosis,
      treatment,
      vaccinationDetails,
      eventDate,
      status,
    } = req.body;

    const imageUrl = req.file ? `/uploads/activities/${req.file.filename}` : null;

    if (!livestockId || !healthIssue || !status) {
      return res.status(400).json({ error: 'Missing required health record fields' });
    }

    const result = await pool.query(
      `
        INSERT INTO livestock_health_events (
          farm_id, animal_id, event_type, notes, diagnosis, treatment,
          medication, event_date, status, reported_by_user_id, image_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_DATE), $9, $10, $11)
        RETURNING id, animal_id, event_type, notes, diagnosis, treatment,
                  medication, event_date, status, reported_by_user_id, image_url, updated_at, created_at
      `,
      [farmId, livestockId, healthIssue, symptoms || null, diagnosis || null, treatment || null, vaccinationDetails || null, eventDate || null, status, req.user.userId, imageUrl],
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      livestockId: row.animal_id,
      healthIssue: row.event_type,
      symptoms: row.notes,
      diagnosis: row.diagnosis,
      treatment: row.treatment,
      vaccinationDetails: row.medication,
      eventDate: row.event_date,
      status: row.status,
      imageUrl: row.image_url,
      updatedBy: row.reported_by_user_id,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error('Failed to create livestock health event:', error);
    res.status(500).json({ error: 'Failed to create livestock health event' });
  }
}
