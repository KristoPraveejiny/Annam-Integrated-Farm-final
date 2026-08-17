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
      assigned_worker_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
      task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
      created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feed_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      livestock_id UUID NOT NULL REFERENCES livestock_animals(id) ON DELETE CASCADE,
      feed_schedule_id UUID REFERENCES feed_schedules(id) ON DELETE SET NULL,
      task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
      feeding_session TEXT NOT NULL,
      scheduled_time TEXT,
      completion_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      feed_required NUMERIC(10,2) NOT NULL DEFAULT 0,
      feed_given NUMERIC(10,2) NOT NULL DEFAULT 0,
      water_required NUMERIC(10,2) NOT NULL DEFAULT 0,
      water_given NUMERIC(10,2) NOT NULL DEFAULT 0,
      difference_feed NUMERIC(10,2) NOT NULL DEFAULT 0,
      difference_water NUMERIC(10,2) NOT NULL DEFAULT 0,
      worker_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
      notes TEXT,
      image_url TEXT,
      appetite TEXT,
      health_observation TEXT,
      status TEXT NOT NULL DEFAULT 'Completed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function resolveFeedFarmId(userId) {
  try {
    return await getDefaultFarmId(userId);
  } catch (error) {
    console.error('Primary farm lookup failed for feed schedule:', error);
  }

  const fallbackQueries = [
    'SELECT farm_id AS id FROM feed_schedules ORDER BY created_at DESC LIMIT 1',
    'SELECT farm_id AS id FROM feed_logs ORDER BY created_at DESC LIMIT 1',
    'SELECT farm_id AS id FROM livestock_animals ORDER BY created_at DESC LIMIT 1',
    'SELECT id FROM farms ORDER BY created_at ASC LIMIT 1',
  ];

  for (const queryText of fallbackQueries) {
    try {
      const result = await pool.query(queryText);
      if (result.rows.length > 0 && result.rows[0].id) {
        return result.rows[0].id;
      }
    } catch (error) {
      console.error('Feed farm fallback lookup failed:', error);
    }
  }

  return null;
}

ensureFeedSchedulesTable().catch((error) => {
  console.error('Failed to ensure feed_schedules table exists:', error);
});

export async function getFeedSchedules(req, res) {
  try {
    const farmId = await resolveFeedFarmId(req.user.userId);
    if (!farmId) {
      return res.json([]);
    }
    const result = await pool.query(
      `
        SELECT s.id, s.livestock_id AS "livestockId", a.tag_code AS "animalTag",
               s.feed_type AS "feedType", s.feed_amount AS "feedAmount",
               s.water_requirement AS "waterRequirement", s.scheduled_time AS "scheduledTime",
               s.status, s.assigned_worker_id AS "assignedWorkerId",
               s.task_id AS "taskId",
               s.created_at AS "createdAt", s.updated_at AS "updatedAt"
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
    const farmId = await resolveFeedFarmId(req.user.userId);
    if (!farmId) {
      return res.status(400).json({ error: 'Unable to resolve farm for feed schedule' });
    }
    const { livestockId, feedType, feedAmount, waterRequirement, scheduledTime, status, assignedWorkerId, session } = req.body;
    if (!livestockId || !feedType || !feedAmount || !waterRequirement || !scheduledTime) {
      return res.status(400).json({ error: 'Missing required schedule fields' });
    }

    const taskTitle = `${String(session || 'Morning')} Feed ${feedType}`.trim();
    let taskId = null;
    if (assignedWorkerId) {
      const taskResult = await pool.query(
        `
          INSERT INTO tasks (
            farm_id, title, description, livestock_group_id, assigned_to_user_id, created_by_user_id,
            priority, due_date, status, session
          )
          VALUES ($1, $2, $3, (SELECT group_id FROM livestock_animals WHERE id = $4 LIMIT 1), $5, $6, 'high', CURRENT_DATE, 'Pending', $7)
          RETURNING id
        `,
        [farmId, taskTitle, `Livestock feeding task for ${feedType}`, livestockId, assignedWorkerId, req.user.userId, session || 'Morning']
      );
      taskId = taskResult.rows[0]?.id || null;
    }

    const result = await pool.query(
      `
        INSERT INTO feed_schedules (
          farm_id, livestock_id, feed_type, feed_amount, water_requirement,
          scheduled_time, status, assigned_worker_id, task_id, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'Planned'), $8, $9, $10)
        RETURNING id, livestock_id, feed_type, feed_amount, water_requirement,
                  scheduled_time, status, assigned_worker_id, task_id, created_at, updated_at
      `,
      [farmId, livestockId, feedType, feedAmount, waterRequirement, scheduledTime, status, assignedWorkerId || null, taskId, req.user.userId],
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
      assignedWorkerId: row.assigned_worker_id,
      taskId: row.task_id,
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
    const farmId = await resolveFeedFarmId(req.user.userId);
    if (!farmId) {
      return res.status(400).json({ error: 'Unable to resolve farm for feed schedule' });
    }
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

export async function getFeedLogs(req, res) {
  try {
    const farmId = await resolveFeedFarmId(req.user.userId);
    if (!farmId) {
      return res.json([]);
    }
    const result = await pool.query(
      `
        SELECT fl.*, a.tag_code AS "animalTag", u.full_name AS "workerName"
        FROM feed_logs fl
        JOIN livestock_animals a ON a.id = fl.livestock_id
        LEFT JOIN app_users u ON u.id = fl.worker_id
        WHERE fl.farm_id = $1
        ORDER BY fl.completion_time DESC
        LIMIT 100
      `,
      [farmId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch feed logs:', error);
    res.status(500).json({ error: 'Failed to fetch feed logs' });
  }
}

export async function getFeedSummary(req, res) {
  try {
    const farmId = await resolveFeedFarmId(req.user.userId);
    if (!farmId) {
      return res.json({
        animalsFedToday: 0,
        pendingFeedings: 0,
        missedFeedings: 0,
        completionPercentage: 0,
        requiredFeed: 0,
        actualFeed: 0,
        requiredWater: 0,
        actualWater: 0,
      });
    }
    const [logs, schedules] = await Promise.all([
      pool.query(`SELECT * FROM feed_logs WHERE farm_id = $1 AND completion_time::date = CURRENT_DATE`, [farmId]),
      pool.query(`SELECT * FROM feed_schedules WHERE farm_id = $1`, [farmId])
    ]);

    const totals = logs.rows.reduce((acc, log) => {
      acc.requiredFeed += Number(log.feed_required || 0);
      acc.actualFeed += Number(log.feed_given || 0);
      acc.requiredWater += Number(log.water_required || 0);
      acc.actualWater += Number(log.water_given || 0);
      return acc;
    }, { requiredFeed: 0, actualFeed: 0, requiredWater: 0, actualWater: 0 });

    res.json({
      animalsFedToday: logs.rows.length,
      pendingFeedings: schedules.filter((item) => String(item.status || '').toLowerCase() === 'planned').length,
      missedFeedings: schedules.filter((item) => String(item.status || '').toLowerCase() === 'missed').length,
      completionPercentage: schedules.length ? Math.round((logs.rows.length / schedules.length) * 100) : 0,
      ...totals,
    });
  } catch (error) {
    console.error('Failed to fetch feed summary:', error);
    res.status(500).json({ error: 'Failed to fetch feed summary' });
  }
}

export async function completeFeedSchedule(req, res) {
  try {
    const farmId = await resolveFeedFarmId(req.user.userId);
    if (!farmId) {
      return res.status(400).json({ error: 'Unable to resolve farm for feed schedule' });
    }
    const { id } = req.params;
    const { feedGiven, waterGiven, feedType, appetite, healthObservation, notes, imageUrl, completionTime, latitude, longitude } = req.body;
    const scheduleRes = await pool.query(`SELECT * FROM feed_schedules WHERE id = $1 AND farm_id = $2 LIMIT 1`, [id, farmId]);
    if (scheduleRes.rows.length === 0) {
      return res.status(404).json({ error: 'Feed schedule not found' });
    }
    const schedule = scheduleRes.rows[0];
    const feedRequired = Number(String(schedule.feed_amount).replace(/[^\d.]/g, '')) || 0;
    const waterRequired = Number(String(schedule.water_requirement).replace(/[^\d.]/g, '')) || 0;
    const actualFeed = Number(feedGiven || 0);
    const actualWater = Number(waterGiven || 0);
    const differenceFeed = actualFeed - feedRequired;
    const differenceWater = actualWater - waterRequired;

    const logRes = await pool.query(
      `
        INSERT INTO feed_logs (
          farm_id, livestock_id, feed_schedule_id, task_id, feeding_session, scheduled_time, completion_time,
          feed_required, feed_given, water_required, water_given, difference_feed, difference_water,
          worker_id, notes, image_url, appetite, health_observation
        )
        VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz, NOW()),$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING *
      `,
      [
        farmId,
        schedule.livestock_id,
        schedule.id,
        schedule.task_id,
        schedule.scheduled_time,
        schedule.scheduled_time,
        completionTime || null,
        feedRequired,
        actualFeed,
        waterRequired,
        actualWater,
        differenceFeed,
        differenceWater,
        req.user.userId,
        notes || null,
        imageUrl || null,
        appetite || null,
        healthObservation || null
      ]
    );

    await pool.query(`UPDATE feed_schedules SET status = 'Completed', updated_at = NOW() WHERE id = $1 AND farm_id = $2`, [id, farmId]);

    if (schedule.task_id) {
      await pool.query(
        `UPDATE tasks SET status = 'Completed', completed_at = NOW(), updated_at = NOW(), completion_notes = COALESCE($2, completion_notes) WHERE id = $1 AND farm_id = $3`,
        [schedule.task_id, notes || null, farmId]
      );
    }

    res.json({ message: 'Feeding completed', log: logRes.rows[0] });
  } catch (error) {
    console.error('Failed to complete feed schedule:', error);
    res.status(500).json({ error: 'Failed to complete feed schedule' });
  }
}
