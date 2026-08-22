import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';

const notifyUsers = async (userIds, farmId, type, title, message, priority = 'Normal') => {
  for (const userId of userIds) {
    await pool.query(
      `INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
       VALUES ($1, $2, $3, $4, $5, $6, 'in-app')`,
      [userId, farmId, type, title, message, priority]
    );
  }
};

const managersOfFarm = async (farmId) => {
  const res = await pool.query(
    `SELECT owner_id AS id FROM farms WHERE id = $1
     UNION
     SELECT fm.user_id AS id
       FROM farm_memberships fm
       JOIN app_users u ON u.id = fm.user_id
      WHERE fm.farm_id = $1 AND u.role IN ('farm_manager', 'super_admin')`,
    [farmId]
  );
  return res.rows.map((row) => row.id);
};

// POST /api/leave-requests - a worker asks for leave
export async function createLeaveRequest(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const { startDate, endDate, reason } = req.body;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'Start date, end date and reason are required.' });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: 'End date cannot be before the start date.' });
    }
    if (String(reason).trim().length < 10) {
      return res.status(400).json({ error: 'Please give a reason of at least 10 characters.' });
    }
    // Two live requests covering the same day would leave the manager deciding
    // the same absence twice.
    const clash = await pool.query(
      `SELECT id, start_date, end_date FROM leave_requests
        WHERE worker_id = $1
          AND status IN ('Pending', 'Approved')
          AND start_date <= $3::date
          AND end_date >= $2::date
        LIMIT 1`,
      [userId, startDate, endDate]
    );
    if (clash.rowCount > 0) {
      return res.status(409).json({ error: 'You already have a leave request covering those dates.' });
    }

    const result = await pool.query(
      `INSERT INTO leave_requests (farm_id, worker_id, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [farmId, userId, startDate, endDate, String(reason).trim()]
    );

    const worker = await pool.query('SELECT full_name FROM app_users WHERE id = $1', [userId]);
    const workerName = worker.rows[0]?.full_name || 'A worker';
    const managers = await managersOfFarm(farmId);
    await notifyUsers(
      managers,
      farmId,
      'leave_request',
      'New Leave Request',
      `${workerName} requested leave from ${startDate} to ${endDate}.`,
      'Normal'
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating leave request:', err);
    res.status(500).json({ error: 'Failed to submit leave request' });
  }
}

// GET /api/leave-requests/mine - the worker's own history
export async function getMyLeaveRequests(req, res) {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      `SELECT lr.*, reviewer.full_name AS reviewed_by_name
         FROM leave_requests lr
         LEFT JOIN app_users reviewer ON reviewer.id = lr.reviewed_by
        WHERE lr.worker_id = $1
        ORDER BY lr.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching leave requests:', err);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
}

// GET /api/leave-requests - every request on the farm (manager view)
export async function getFarmLeaveRequests(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const { status } = req.query;

    const params = [farmId];
    let statusFilter = '';
    if (status && status !== 'all') {
      params.push(status);
      statusFilter = ` AND lr.status = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT lr.*, w.full_name AS worker_name, w.email AS worker_email,
              reviewer.full_name AS reviewed_by_name,
              (lr.end_date - lr.start_date + 1) AS total_days
         FROM leave_requests lr
         JOIN app_users w ON w.id = lr.worker_id
         LEFT JOIN app_users reviewer ON reviewer.id = lr.reviewed_by
        WHERE lr.farm_id = $1${statusFilter}
        ORDER BY
          CASE lr.status WHEN 'Pending' THEN 0 ELSE 1 END,
          lr.start_date DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching farm leave requests:', err);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
}

// PUT /api/leave-requests/:id/status - manager approves or rejects
export async function updateLeaveStatus(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const { id } = req.params;
    const { status, managerNotes } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Approved or Rejected.' });
    }

    const existing = await pool.query(
      'SELECT * FROM leave_requests WHERE id = $1 AND farm_id = $2',
      [id, farmId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const request = existing.rows[0];

    // Approving leave that already has work assigned would silently create the
    // clash this feature exists to prevent - surface it instead.
    let assignedTasks = [];
    if (status === 'Approved') {
      const clash = await pool.query(
        `SELECT id, title, due_date FROM tasks
          WHERE assigned_to_user_id = $1
            AND due_date::date BETWEEN $2::date AND $3::date
            AND status NOT IN ('Completed', 'completed', 'Approved', 'Cancelled')`,
        [request.worker_id, request.start_date, request.end_date]
      );
      assignedTasks = clash.rows;
    }

    const result = await pool.query(
      `UPDATE leave_requests
          SET status = $1, manager_notes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
        WHERE id = $4 RETURNING *`,
      [status, managerNotes || null, userId, id]
    );

    await notifyUsers(
      [request.worker_id],
      farmId,
      'leave_status',
      `Leave ${status}`,
      `Your leave from ${new Date(request.start_date).toLocaleDateString()} to ${new Date(request.end_date).toLocaleDateString()} was ${status.toLowerCase()}.${managerNotes ? ` Note: ${managerNotes}` : ''}`,
      status === 'Approved' ? 'Normal' : 'High'
    );

    res.json({ ...result.rows[0], conflictingTasks: assignedTasks });
  } catch (err) {
    console.error('Error updating leave status:', err);
    res.status(500).json({ error: 'Failed to update leave request' });
  }
}

// DELETE /api/leave-requests/:id - a worker withdraws a request still pending
export async function cancelLeaveRequest(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE leave_requests
          SET status = 'Cancelled', updated_at = NOW()
        WHERE id = $1 AND worker_id = $2 AND status = 'Pending'
        RETURNING *`,
      [id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Only your own pending requests can be cancelled.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error cancelling leave request:', err);
    res.status(500).json({ error: 'Failed to cancel leave request' });
  }
}

/**
 * GET /api/leave-requests/worker/:workerId/dates
 *
 * The individual dates a worker is on approved leave, so the assign-task date
 * picker can grey them out rather than letting the manager pick a day the
 * server will reject.
 */
export async function getWorkerLeaveDates(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const { workerId } = req.params;

    const result = await pool.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day
         FROM leave_requests lr,
              LATERAL generate_series(lr.start_date, lr.end_date, interval '1 day') AS day
        WHERE lr.worker_id = $1
          AND lr.farm_id = $2
          AND lr.status = 'Approved'
          AND lr.end_date >= CURRENT_DATE - interval '30 days'
        ORDER BY day`,
      [workerId, farmId]
    );

    res.json({ workerId, dates: result.rows.map((row) => row.day) });
  } catch (err) {
    console.error('Error fetching worker leave dates:', err);
    res.status(500).json({ error: 'Failed to fetch leave dates' });
  }
}

/**
 * Whether a worker has approved leave covering a date. Used by task creation so
 * the rule holds even if a request bypasses the UI.
 */
export async function isWorkerOnLeave(workerId, date) {
  if (!workerId || !date) return null;
  const result = await pool.query(
    `SELECT id, start_date, end_date FROM leave_requests
      WHERE worker_id = $1 AND status = 'Approved'
        AND $2::date BETWEEN start_date AND end_date
      LIMIT 1`,
    [workerId, date]
  );
  return result.rows[0] || null;
}
