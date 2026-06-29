import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';

async function ensureLivestockHealthEventsTable() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS livestock_health_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      livestock_id UUID NOT NULL REFERENCES livestock_animals(id) ON DELETE CASCADE,
      health_issue TEXT NOT NULL,
      symptoms TEXT,
      diagnosis TEXT,
      treatment TEXT,
      vaccination_details TEXT,
      event_date DATE NOT NULL DEFAULT CURRENT_DATE,
      status TEXT NOT NULL DEFAULT 'healthy',
      updated_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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
        SELECT h.id, h.livestock_id AS "livestockId", a.tag_code AS "animalTag",
               h.health_issue AS "healthIssue", h.symptoms, h.diagnosis,
               h.treatment, h.vaccination_details AS "vaccinationDetails",
               h.event_date AS "eventDate", h.status, h.updated_by AS "updatedBy",
               h.updated_at AS "updatedAt", h.created_at AS "createdAt"
        FROM livestock_health_events h
        LEFT JOIN livestock_animals a ON a.id = h.livestock_id
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

    if (!livestockId || !healthIssue || !status) {
      return res.status(400).json({ error: 'Missing required health record fields' });
    }

    const result = await pool.query(
      `
        INSERT INTO livestock_health_events (
          farm_id, livestock_id, health_issue, symptoms, diagnosis, treatment,
          vaccination_details, event_date, status, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_DATE), $9, $10)
        RETURNING id, livestock_id, health_issue, symptoms, diagnosis, treatment,
                  vaccination_details, event_date, status, updated_by, updated_at, created_at
      `,
      [farmId, livestockId, healthIssue, symptoms || null, diagnosis || null, treatment || null, vaccinationDetails || null, eventDate || null, status, req.user.userId],
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      livestockId: row.livestock_id,
      healthIssue: row.health_issue,
      symptoms: row.symptoms,
      diagnosis: row.diagnosis,
      treatment: row.treatment,
      vaccinationDetails: row.vaccination_details,
      eventDate: row.event_date,
      status: row.status,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error('Failed to create livestock health event:', error);
    res.status(500).json({ error: 'Failed to create livestock health event' });
  }
}
