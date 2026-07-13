import { pool } from '../db.js';
import { sendEmail, sendTaskAssignedEmail } from '../services/emailService.js';
import { getDefaultFarmId } from './livestockController.js';
import { daysInMonth } from '../utils/payrollMath.js';

function normalizeDateInput(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const asString = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(asString.slice(0, 10))) {
    return asString.slice(0, 10);
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function normalizeShiftKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeTaskStatus(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function monthKeyForDate(date = new Date()) {
  const asDate = date instanceof Date ? date : new Date(date);
  return asDate.toISOString().slice(0, 7);
}

function monthStartForKey(monthKey) {
  return `${monthKey}-01`;
}

async function upsertMonthlyPayrollAfterApproval({ farmId, managerId, workerId, effectiveDate = new Date() }) {
  const paymentMonth = monthKeyForDate(effectiveDate);
  const monthStart = monthStartForKey(paymentMonth);
  const [paymentYear, paymentMonthNumber] = paymentMonth.split('-').map(Number);

  const [attendanceStats, taskStats, workerRes] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS completed_shifts,
        COUNT(DISTINCT DATE(sa.date))::int AS active_days,
        COALESCE(SUM(CASE WHEN LOWER(s.shift_name) = 'morning' THEN 1 ELSE 0 END), 0)::int AS morning_shifts,
        COALESCE(SUM(CASE WHEN LOWER(s.shift_name) = 'afternoon' THEN 1 ELSE 0 END), 0)::int AS afternoon_shifts,
        COALESCE(SUM(CASE WHEN LOWER(s.shift_name) = 'evening' THEN 1 ELSE 0 END), 0)::int AS evening_shifts,
        COALESCE(SUM(COALESCE(sa.total_hours, 0)), 0)::numeric AS total_working_hours,
        COALESCE(SUM(COALESCE(s.base_wage, 0)), 0)::numeric AS shift_wage_earned,
        COALESCE(SUM(GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0) * COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0)), 0)::numeric AS overtime_pay
      FROM shift_attendances sa
      LEFT JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.farm_id = $1
        AND sa.worker_id = $2
        AND sa.shift_status IN ('Present', 'Approved')
        AND sa.date >= $3::date
        AND sa.date < ($3::date + INTERVAL '1 month')
    `, [farmId, workerId, monthStart]),
    pool.query(`
      SELECT COUNT(*)::int AS total_completed_tasks
      FROM tasks
      WHERE farm_id = $1
        AND assigned_to_user_id = $2
        AND status = 'Completed'
        AND completed_at >= $3::date
        AND completed_at < ($3::date + INTERVAL '1 month')
    `, [farmId, workerId, monthStart]),
    pool.query('SELECT id FROM app_users WHERE id = $1', [workerId]),
  ]);

  if (workerRes.rows.length === 0) return;

  const attendance = attendanceStats.rows[0] || {};
  const tasks = taskStats.rows[0] || {};
  const equivalentPresentDays = Number((Number(attendance.completed_shifts || 0) / 3).toFixed(2));
  const attendancePercentage = Number(((Number(attendance.completed_shifts || 0) / Math.max(daysInMonth(paymentMonthNumber, paymentYear) * 3, 1)) * 100).toFixed(2));
  const attendanceStatus = Number(attendance.completed_shifts || 0) === 0
    ? 'Absent'
    : equivalentPresentDays >= 1
      ? 'Present'
      : 'Half Day';
  const shiftWageEarned = Number(attendance.shift_wage_earned || 0);
  const overtimePay = Number(attendance.overtime_pay || 0);
  const bonus = 0;
  const deductions = 0;
  const gross = Number((shiftWageEarned + overtimePay + bonus - deductions).toFixed(2));
  const monthDays = daysInMonth(paymentMonthNumber, paymentYear);

  const existing = await pool.query(
    'SELECT id FROM monthly_salary_payments WHERE farm_id = $1 AND worker_id = $2 AND payment_month = $3 LIMIT 1',
    [farmId, workerId, paymentMonth]
  );

  const payload = [
    farmId,
    workerId,
    managerId,
    paymentMonth,
    tasks.total_completed_tasks || 0,
    attendance.active_days || 0,
    0,
    Math.max(monthDays - Number(attendance.active_days || 0), 0),
    attendance.morning_shifts || 0,
    attendance.afternoon_shifts || 0,
    attendance.evening_shifts || 0,
    attendance.total_working_hours || 0,
    overtimePay,
    shiftWageEarned,
    0,
    bonus,
    0,
    deductions,
    gross,
    gross,
  ];

  if (existing.rows.length > 0) {
    await pool.query(`
      UPDATE monthly_salary_payments
      SET manager_id = COALESCE($1, manager_id),
          total_completed_tasks = $2,
          total_approved_sessions = $3,
          present_days = $4,
          half_days = $5,
          morning_shifts = $6,
          afternoon_shifts = $7,
          evening_shifts = $8,
          total_working_hours = $9,
          overtime = $10,
          base_salary = $11,
          hourly_wage_total = $12,
          holiday_wages = $13,
          weekend_wages = $14,
          deductions = $15,
          gross_salary = $16,
          net_salary = $17,
          updated_at = NOW()
      WHERE id = $18
    `, [
      managerId,
      payload[4],
      payload[5],
      payload[6],
      payload[7],
      payload[8],
      payload[9],
      payload[10],
      payload[11],
      payload[12],
      payload[13],
      payload[14],
      payload[15],
      payload[16],
      payload[17],
      payload[18],
      payload[19],
      existing.rows[0].id
    ]);
  } else {
    await pool.query(`
      INSERT INTO monthly_salary_payments (
        farm_id, worker_id, manager_id, payment_month,
        total_completed_tasks, total_approved_sessions, present_days, half_days,
        morning_shifts, afternoon_shifts, evening_shifts,
        total_working_hours, overtime, base_salary, hourly_wage_total,
        holiday_wages, weekend_wages, deductions, gross_salary, net_salary,
        payment_status
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        'Pending'
      )
    `, payload);
  }
}

async function notifyFarmerOfReview({ workerId, task, action, reason }) {
  const farmerRes = await pool.query(
    'SELECT email, phone, full_name FROM app_users WHERE id = $1',
    [workerId]
  );

  if (farmerRes.rows.length === 0) return;

  const farmer = farmerRes.rows[0];
  const humanAction =
    action === 'Approve' ? 'approved' :
    action === 'Reject' ? 'rejected' :
    'sent back for rework';

  const detailNote = reason ? `<p><strong>Reason:</strong> ${reason}</p>` : '';
  if (farmer.email) {
    await sendEmail({
      to: farmer.email,
      subject: `Task ${humanAction.charAt(0).toUpperCase() + humanAction.slice(1)}`,
      html: `
        <h2>Task ${humanAction.charAt(0).toUpperCase() + humanAction.slice(1)}</h2>
        <p>Your task <strong>${task.title}</strong> has been ${humanAction}.</p>
        ${detailNote}
        <p>Please check your dashboard for the latest status.</p>
      `,
      text: `Your task ${task.title} has been ${humanAction}. ${reason || ''}`.trim(),
    });
  }

  if (farmer.phone) {
    console.log(`SMS to ${farmer.phone}: Task "${task.title}" has been ${humanAction}. ${reason || ''}`.trim());
  }
}

async function resolveShiftForTask(farmId, { shiftId, session }) {
  if (shiftId) {
    const byId = await pool.query(
      'SELECT id, shift_name FROM shifts WHERE id = $1 AND farm_id = $2 LIMIT 1',
      [shiftId, farmId]
    );

    if (byId.rows.length > 0) {
      return byId.rows[0];
    }
  }

  const sessionKey = normalizeShiftKey(session);
  if (sessionKey) {
    const byName = await pool.query(
      'SELECT id, shift_name FROM shifts WHERE farm_id = $1 AND LOWER(shift_name) = $2 LIMIT 1',
      [farmId, sessionKey]
    );

    if (byName.rows.length > 0) {
      return byName.rows[0];
    }
  }

  return null;
}

export async function syncAttendanceFromCompletedTasks({ farmId, workerId = null, month = null, year = null, managerId = null } = {}) {
  const params = [farmId];
  const filters = [];

  if (workerId) {
    params.push(workerId);
    filters.push(`t.assigned_to_user_id = $${params.length}`);
  }

  if (month && year) {
    params.push(month, year);
    filters.push(`EXTRACT(MONTH FROM COALESCE(t.completed_at, t.end_time, t.updated_at)) = $${params.length - 1}`);
    filters.push(`EXTRACT(YEAR FROM COALESCE(t.completed_at, t.end_time, t.updated_at)) = $${params.length}`);
  }

  const query = `
    SELECT
      t.id,
      t.assigned_to_user_id AS worker_id,
      t.shift_id,
      t.started_at,
      t.completed_at,
      t.end_time,
      t.updated_at,
      t.working_hours,
      DATE(COALESCE(t.completed_at, t.end_time, t.updated_at)) AS attendance_date
    FROM tasks t
    LEFT JOIN shift_attendances sa
      ON sa.worker_id = t.assigned_to_user_id
      AND sa.shift_id = t.shift_id
      AND DATE_TRUNC('second', sa.check_out_time) = DATE_TRUNC('second', COALESCE(t.completed_at, t.end_time, t.updated_at))
    WHERE t.farm_id = $1
      AND t.status = 'Completed'
      AND t.assigned_to_user_id IS NOT NULL
      AND COALESCE(t.completed_at, t.end_time, t.updated_at) IS NOT NULL
      AND sa.id IS NULL
      ${filters.length > 0 ? `AND ${filters.join(' AND ')}` : ''}
    ORDER BY t.completed_at DESC, t.updated_at DESC
  `;

  const result = await pool.query(query, params);
  const workersToRebuild = new Map();

  for (const task of result.rows) {
    const attendanceDate = normalizeDateInput(task.attendance_date);
    if (!attendanceDate) continue;

    const checkInTime = task.started_at || task.updated_at || task.completed_at || null;
    const checkOutTime = task.completed_at || task.end_time || task.updated_at || null;
    const hours = Number(task.working_hours || 0);

    const existingAttendance = await pool.query(
      `SELECT id FROM shift_attendances
       WHERE worker_id = $1 AND shift_id = $3 AND farm_id = $4
         AND DATE_TRUNC('second', check_out_time) = DATE_TRUNC('second', $2::timestamptz)
       LIMIT 1`,
      [task.worker_id, checkOutTime, task.shift_id, farmId]
    );

    if (existingAttendance.rows.length > 0) {
      continue;
    }

    await pool.query(`
      INSERT INTO shift_attendances (
        worker_id, date, shift_id, check_in_time, check_out_time, total_hours, shift_status, farm_id
      ) VALUES ($1, $2::date, $3, $4, $5, $6, 'Present', $7)
    `, [
      task.worker_id,
      attendanceDate,
      task.shift_id,
      checkInTime,
      checkOutTime,
      hours,
      farmId,
    ]);

    const previous = workersToRebuild.get(task.worker_id);
    if (!previous || attendanceDate > previous) {
      workersToRebuild.set(task.worker_id, attendanceDate);
    }
  }

  for (const [syncedWorkerId, effectiveDate] of workersToRebuild.entries()) {
    await upsertMonthlyPayrollAfterApproval({
      farmId,
      managerId,
      workerId: syncedWorkerId,
      effectiveDate,
    });
  }

  return {
    syncedTasks: result.rows.length,
    syncedWorkers: workersToRebuild.size,
  };
}

async function validateTaskDate(req, res, dueDate) {
  if (!dueDate) return null;

  const normalizedDueDate = normalizeDateInput(dueDate);
  if (!normalizedDueDate) {
    res.status(400).json({ error: 'Invalid task date' });
    return null;
  }

  const todayResult = await pool.query('SELECT CURRENT_DATE AS today');
  const todayValue = todayResult.rows[0]?.today;
  const today = new Date(todayValue).toISOString().slice(0, 10);

  if (normalizedDueDate < today) {
    res.status(400).json({ error: 'Task date cannot be earlier than today.' });
    return null;
  }

  return normalizedDueDate;
}

export async function getWorkers(req, res) {
  try {
    const userId = req.user.userId;
    // For now we just return users with role 'worker'
    // Ideally, we'd join with farm_workers table, but if there isn't one, this works as mock
    const result = await pool.query(`SELECT id, full_name as name FROM app_users WHERE role::text IN ('worker', 'farmer')`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching workers:', err);
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
}

export async function createTask(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const {
      title,
      description,
      cropCycleId,
      assignedToUserId,
      priority,
      dueDate,
      livestockGroupId,
      shiftId,
      session
    } = req.body;

    const resolvedShift = await resolveShiftForTask(farmId, { shiftId, session });
    if (!title || !assignedToUserId || !resolvedShift) {
      return res.status(400).json({ error: 'Title, assignedToUserId, and a valid shift are required' });
    }

    const validatedDueDate = await validateTaskDate(req, res, dueDate);
    if (dueDate && !validatedDueDate) {
      return;
    }

    // Insert task
    const result = await pool.query(`
      INSERT INTO tasks 
      (farm_id, title, description, crop_cycle_id, livestock_group_id, assigned_to_user_id, created_by_user_id, priority, due_date, status, shift_id, session)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending', $10, $11)
      RETURNING *
    `, [
      farmId,
      title,
      description || null,
      cropCycleId || null,
      livestockGroupId || null,
      assignedToUserId,
      userId,
      priority || 'medium',
      validatedDueDate || null,
      resolvedShift.id,
      normalizeShiftKey(resolvedShift.shift_name)
    ]);

    const task = result.rows[0];

    // Fetch farmer email and crop details for email
    const farmerRes = await pool.query('SELECT email, full_name FROM app_users WHERE id = $1', [assignedToUserId]);
    
    let cropName = 'N/A';
    if (cropCycleId) {
      const cropRes = await pool.query('SELECT crop_name FROM crop_cycles WHERE id = $1', [cropCycleId]);
      if (cropRes.rows.length > 0) {
        cropName = cropRes.rows[0].crop_name;
      }
    } else if (livestockGroupId) {
      const liveRes = await pool.query('SELECT group_code, species FROM livestock_groups WHERE id = $1', [livestockGroupId]);
      if (liveRes.rows.length > 0) {
        cropName = `${liveRes.rows[0].species} (${liveRes.rows[0].group_code})`;
      }
    }

    if (farmerRes.rows.length > 0) {
      const farmerEmail = farmerRes.rows[0].email;
      await sendTaskAssignedEmail(farmerEmail, {
        title,
        description,
        priority,
        dueDate,
        relatedEntity: cropName
      });

      // Insert notification
      await pool.query(`
        INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        assignedToUserId,
        farmId,
        'TASK_ASSIGNED',
        'New Task Assigned',
        `You have been assigned a new task: ${title}`,
        'high',
        'Dashboard'
      ]);

      // Emit Socket.IO Event
      if (req.io) {
        req.io.to(assignedToUserId).emit('notification', {
          title: 'New Task Assigned',
          message: `You have been assigned a new task: ${title}`,
          category: 'TASK_ASSIGNED',
          priority: 'high'
        });
      }
    }

    res.status(201).json({ message: 'Task created successfully', task });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
}

export async function updateTaskDetails(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const taskId = req.params.id;
    const {
      title,
      description,
      cropCycleId,
      livestockGroupId,
      assignedToUserId,
      priority,
      dueDate,
      session,
      shiftId,
    } = req.body;

    const validatedDueDate = await validateTaskDate(req, res, dueDate);
    if (dueDate && !validatedDueDate) {
      return;
    }

    const currentTaskResult = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND farm_id = $2',
      [taskId, farmId]
    );

    if (currentTaskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }

    const currentTask = currentTaskResult.rows[0];
    const nextTitle = title ?? currentTask.title;
    const nextDescription = description ?? currentTask.description;
    const nextCropCycleId = cropCycleId ?? currentTask.crop_cycle_id;
    const nextLivestockGroupId = livestockGroupId ?? currentTask.livestock_group_id;
    const nextAssignedToUserId = assignedToUserId ?? currentTask.assigned_to_user_id;
    const nextPriority = priority ?? currentTask.priority;
    const nextDueDate = dueDate ? validatedDueDate : currentTask.due_date;
    const nextSession = session ?? currentTask.session;
    const resolvedShift = await resolveShiftForTask(farmId, {
      shiftId: shiftId ?? currentTask.shift_id,
      session: nextSession,
    });
    const nextShiftId = resolvedShift?.id ?? currentTask.shift_id;

    const result = await pool.query(`
      UPDATE tasks
      SET title = $1,
          description = $2,
          crop_cycle_id = $3,
          livestock_group_id = $4,
          assigned_to_user_id = $5,
          priority = $6,
          due_date = $7,
          session = $8,
          shift_id = $9,
          updated_at = NOW()
      WHERE id = $10 AND farm_id = $11
      RETURNING *
    `, [
      nextTitle,
      nextDescription,
      nextCropCycleId,
      nextLivestockGroupId,
      nextAssignedToUserId,
      nextPriority,
      nextDueDate,
      nextSession,
      nextShiftId,
      taskId,
      farmId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }

    res.json({ message: 'Task updated successfully', task: result.rows[0] });
  } catch (err) {
    console.error('Error updating task details:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
}

export async function getFarmerTasks(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const result = await pool.query(`
      SELECT t.*, c.crop_name, c.variety, l.species as livestock_name
      FROM tasks t
      LEFT JOIN crop_cycles c ON t.crop_cycle_id = c.id
      LEFT JOIN livestock_groups l ON t.livestock_group_id = l.id
      WHERE t.farm_id = $1 AND t.assigned_to_user_id = $2
      ORDER BY t.created_at DESC
    `, [farmId, userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching farmer tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

export async function getFarmManagerTasks(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const result = await pool.query(`
      SELECT t.*, u.full_name as assigned_to_name, c.crop_name, l.species as livestock_name
      FROM tasks t
      LEFT JOIN app_users u ON t.assigned_to_user_id = u.id
      LEFT JOIN crop_cycles c ON t.crop_cycle_id = c.id
      LEFT JOIN livestock_groups l ON t.livestock_group_id = l.id
      WHERE t.farm_id = $1
      ORDER BY t.created_at DESC
    `, [farmId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching farm tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

export async function startTask(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const taskId = req.params.id;

    const result = await pool.query(`
      UPDATE tasks
      SET status = 'In Progress', started_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND farm_id = $2 AND assigned_to_user_id = $3 AND status = 'Pending'
      RETURNING *
    `, [taskId, farmId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found, unauthorized, or not in Pending status' });
    }

    const task = result.rows[0];

    // Notification to manager
    const managerRes = await pool.query('SELECT created_by_user_id FROM tasks WHERE id = $1', [taskId]);
    if (managerRes.rows.length > 0) {
      const managerId = managerRes.rows[0].created_by_user_id;
      
      await pool.query(`
        INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        managerId,
        farmId,
        'TASK_STARTED',
        'Worker Started Task',
        `Worker has started task: ${task.title}`,
        'normal',
        'Dashboard'
      ]);

      if (req.io) {
        req.io.to(managerId).emit('notification', {
          title: 'Worker Started Task',
          message: `Worker has started task: ${task.title}`,
          category: 'TASK_STARTED',
          priority: 'normal'
        });
      }
    }

    res.json({ message: 'Task started successfully', task });
  } catch (err) {
    console.error('Error starting task:', err);
    res.status(500).json({ error: 'Failed to start task' });
  }
}

export async function submitTaskEvidence(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const taskId = req.params.id;
    const { notes } = req.body;
    
    // In a real app we might handle multiple images; for now we use the uploaded file
    const imageUrl = req.file ? `/uploads/activities/${req.file.filename}` : null;

    if (!notes && !imageUrl) {
        return res.status(400).json({ error: 'Evidence (notes or image) is required' });
    }

    // End timer
    const result = await pool.query(`
      UPDATE tasks
      SET status = 'Waiting Manager Approval', 
          completed_at = NOW(), 
          end_time = NOW(),
          working_hours = EXTRACT(EPOCH FROM (NOW() - started_at))/3600,
          updated_at = NOW()
      WHERE id = $1 AND farm_id = $2 AND assigned_to_user_id = $3 AND status = 'In Progress'
      RETURNING *
    `, [taskId, farmId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found, unauthorized, or not In Progress' });
    }

    const task = result.rows[0];

    await pool.query(
      `INSERT INTO task_updates (task_id, farmer_id, notes, image_url) VALUES ($1, $2, $3, $4)`,
      [taskId, userId, notes || null, imageUrl]
    );

    // Notify manager
    const managerId = task.created_by_user_id;
    await pool.query(`
      INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      managerId,
      farmId,
      'TASK_EVIDENCE_SUBMITTED',
      'Task Evidence Submitted',
      `Evidence submitted for task: ${task.title}. Waiting for your approval.`,
      'high',
      'Dashboard'
    ]);

    if (req.io) {
      req.io.to(managerId).emit('notification', {
        title: 'Task Evidence Submitted',
        message: `Evidence submitted for task: ${task.title}. Waiting for your approval.`,
        category: 'TASK_EVIDENCE_SUBMITTED',
        priority: 'high'
      });
    }

    res.json({ message: 'Evidence submitted successfully', task });
  } catch (err) {
    console.error('Error submitting evidence:', err);
    res.status(500).json({ error: 'Failed to submit evidence' });
  }
}

export async function reviewTask(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const taskId = req.params.id;
    const { action, reason } = req.body; // 'Approve', 'Reject', 'Rework'

    if (!['Approve', 'Reject', 'Rework'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if ((action === 'Reject' || action === 'Rework') && !String(reason || '').trim()) {
      return res.status(400).json({ error: 'A reason is required for reject or rework' });
    }

    let status = 'Completed';
    if (action === 'Reject') status = 'Rejected';
    if (action === 'Rework') status = 'Rework Requested';

    const taskLookup = await pool.query(`
      SELECT *
      FROM tasks
      WHERE id = $1 AND farm_id = $2
      LIMIT 1
    `, [taskId, farmId]);

    if (taskLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found, unauthorized, or not Waiting for Approval' });
    }

    const task = taskLookup.rows[0];
    const taskStatus = normalizeTaskStatus(task.status);
    const waitingStatuses = new Set(['waiting_manager_approval', 'waiting_for_manager_approval']);
    if (!waitingStatuses.has(taskStatus)) {
      return res.status(404).json({ error: 'Task not found, unauthorized, or not Waiting for Approval' });
    }

    const result = await pool.query(`
      UPDATE tasks
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND farm_id = $3
      RETURNING *
    `, [status, taskId, farmId]);

    const updatedTask = result.rows[0] || task;
    const workerId = task.assigned_to_user_id;
    const attendanceDate = normalizeDateInput(updatedTask.completed_at || updatedTask.end_time || updatedTask.updated_at || new Date()) || new Date().toISOString().slice(0, 10);

    // Insert Audit Log
    await pool.query(`
      INSERT INTO audit_logs (user_id, user_role, module, action, record_id, new_value)
      VALUES ($1, 'Farm Manager', 'Task Management', 'Review Task', $2, $3)
    `, [userId, taskId, JSON.stringify({ status, reason: reason || null })]);

    // If Approved, Mark Attendance
    if (status === 'Completed') {
        const checkInTime = updatedTask.start_time || updatedTask.started_at;
        const checkOutTime = updatedTask.end_time || updatedTask.completed_at;

        const existingAttendance = await pool.query(
          `SELECT id FROM shift_attendances
           WHERE worker_id = $1 AND shift_id = $3
             AND DATE_TRUNC('second', check_out_time) = DATE_TRUNC('second', $2::timestamptz)
           LIMIT 1`,
          [workerId, checkOutTime, updatedTask.shift_id]
        );

        if (existingAttendance.rows.length > 0) {
          await pool.query(`
            UPDATE shift_attendances
            SET check_in_time = $1,
                check_out_time = $2,
                total_hours = $3,
                shift_status = 'Present',
                updated_at = NOW()
            WHERE id = $4
          `, [checkInTime, checkOutTime, updatedTask.working_hours, existingAttendance.rows[0].id]);
        } else {
          await pool.query(`
            INSERT INTO shift_attendances (worker_id, date, shift_id, check_in_time, check_out_time, total_hours, shift_status, farm_id)
            VALUES ($1, $2::date, $3, $4, $5, $6, 'Present', $7)
          `, [workerId, attendanceDate, updatedTask.shift_id, checkInTime, checkOutTime, updatedTask.working_hours, farmId]);
        }

        await upsertMonthlyPayrollAfterApproval({ farmId, managerId: userId, workerId, effectiveDate: attendanceDate });
    }

    await notifyFarmerOfReview({ workerId, task: updatedTask, action, reason });

    // Notify worker
    await pool.query(`
      INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      workerId,
      farmId,
      'TASK_REVIEWED',
      'Task Review Completed',
      `Your task "${updatedTask.title}" has been ${status}.`,
      'high',
      'Dashboard'
    ]);

    if (req.io) {
      req.io.to(workerId).emit('notification', {
        title: 'Task Review Completed',
        message: `Your task "${updatedTask.title}" has been ${status}.`,
        category: 'TASK_REVIEWED',
        priority: 'high'
      });
    }

    res.json({ message: `Task ${status} successfully`, task: updatedTask });
  } catch (err) {
    console.error('Error reviewing task:', err);
    res.status(500).json({ error: 'Failed to review task' });
  }
}

export async function getRecentTaskUpdates(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const query = `
      SELECT tu.id, tu.notes, tu.image_url, tu.created_at,
             t.id as task_id, t.title as task_title, t.description as task_description,
             t.status as task_status, t.started_at, t.completed_at, t.working_hours, t.shift_id,
             t.crop_cycle_id, t.livestock_group_id,
             u.id as farmer_id, u.full_name as farmer_name, u.phone as farmer_phone,
             c.crop_name, l.species as livestock_name
      FROM task_updates tu
      JOIN tasks t ON tu.task_id = t.id
      JOIN app_users u ON tu.farmer_id = u.id
      LEFT JOIN crop_cycles c ON t.crop_cycle_id = c.id
      LEFT JOIN livestock_groups l ON t.livestock_group_id = l.id
      WHERE t.farm_id = $1
      ORDER BY tu.created_at DESC
      LIMIT 10
    `;
    const result = await pool.query(query, [farmId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent task updates:', err);
    res.status(500).json({ error: 'Failed to fetch task updates' });
  }
}

