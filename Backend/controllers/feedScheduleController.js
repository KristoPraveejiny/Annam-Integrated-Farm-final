import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';

async function ensureFeedSchedulesTable() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feed_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      livestock_id UUID NOT NULL REFERENCES livestock_animals(id) ON DELETE CASCADE,
      feed_type TEXT NOT NULL,
      feed_amount TEXT NOT NULL,
      water_requirement TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Planned',
      created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

ensureFeedSchedulesTable().catch((error) => {
  console.error('Failed to ensure feed_schedules table exists:', error);
});

export async function getFeedSchedules(req, res) {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);
    const result = await pool.query(
      `
        SELECT s.id, s.livestock_id AS "livestockId", a.tag_code AS "animalTag",
               s.feed_type AS "feedType", s.feed_amount AS "feedAmount",
               s.water_requirement AS "waterRequirement", s.scheduled_time AS "scheduledTime",
               s.status, s.created_at AS "createdAt", s.updated_at AS "updatedAt"
        FROM feed_schedules s
        LEFT JOIN livestock_animals a ON a.id = s.livestock_id
        WHERE s.farm_id = $1
        ORDER BY s.created_at DESC
      `,
      [farmId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch feed schedules:', error);
    res.status(500).json({ error: 'Failed to fetch feed schedules' });
  }
}

export async function createFeedSchedule(req, res) {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);
    const { livestockId, feedType, feedAmount, waterRequirement, scheduledTime, status } = req.body;
    if (!livestockId || !feedType || !feedAmount || !waterRequirement || !scheduledTime) {
      return res.status(400).json({ error: 'Missing required schedule fields' });
    }

    const result = await pool.query(
      `
        INSERT INTO feed_schedules (
          farm_id, livestock_id, feed_type, feed_amount, water_requirement,
          scheduled_time, status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'Planned'), $8)
        RETURNING id, livestock_id, feed_type, feed_amount, water_requirement,
                  scheduled_time, status, created_at, updated_at
      `,
      [farmId, livestockId, feedType, feedAmount, waterRequirement, scheduledTime, status, req.user.userId],
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      livestockId: row.livestock_id,
      feedType: row.feed_type,
      feedAmount: row.feed_amount,
      waterRequirement: row.water_requirement,
      scheduledTime: row.scheduled_time,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Failed to create feed schedule:', error);
    res.status(500).json({ error: 'Failed to create feed schedule' });
  }
}

export async function updateFeedScheduleStatus(req, res) {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const result = await pool.query(
      `
        UPDATE feed_schedules
        SET status = $1,
            updated_at = NOW()
        WHERE id = $2 AND farm_id = $3
        RETURNING id, livestock_id, feed_type, feed_amount, water_requirement, scheduled_time, status, created_at, updated_at
      `,
      [status, id, farmId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Feed schedule not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      livestockId: row.livestock_id,
      feedType: row.feed_type,
      feedAmount: row.feed_amount,
      waterRequirement: row.water_requirement,
      scheduledTime: row.scheduled_time,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Failed to update feed schedule status:', error);
    res.status(500).json({ error: 'Failed to update feed schedule status' });
  }
}
