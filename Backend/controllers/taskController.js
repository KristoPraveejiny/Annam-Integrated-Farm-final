import { calculateAIEvidenceVerification } from '../services/aiEvidenceService.js';
import { pool } from '../db.js';
import crypto from 'crypto';
import fs from 'fs';
import exifr from 'exifr';
import { sendEmail, sendTaskAssignedEmail } from '../services/emailService.js';
import { getDefaultFarmId } from './livestockController.js';
import { daysInMonth } from '../utils/payrollMath.js';

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hasDuplicateFlag(flags = []) {
  return flags.some((flag) => /duplicate|already been submitted/i.test(String(flag || '')));
}

function evidenceStateFromScore(score, flags = []) {
  if (score >= 75 && !hasDuplicateFlag(flags)) return 'Verified';
  return 'Needs Manager Review';
}

async function getUploadCapturedAt(file, fallback = new Date()) {
  try {
    const metadata = await exifr.parse(file.path, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']);
    const value = metadata?.DateTimeOriginal || metadata?.CreateDate || metadata?.ModifyDate;
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : fallback;
  } catch {
    return fallback;
  }
}


async function calculateSmartVerification(images, currentHashes, prevHashes, notes, currentTask, timeDiffMins, reqFiles) {
  let sImage = 0;
  let sDuplicate = 30;
  let sDuration = 20;
  let sCompleteness = 0;
  let sAI = 0;

  const suspiciousFlags = [];
  const imageStatus = images.map(img => ({ ...img, status: '✓' }));

  // 1. Minimum Image Requirement (20 Points)
  if (images.length >= 2) {
    sImage = 20;
  } else {
    suspiciousFlags.push('Additional work evidence required.');
  }

  // 2. Duplicate Image Detection (30 Points)
  let hasDuplicate = false;
  const seenHashes = new Set();
  currentHashes.forEach((hash, idx) => {
    if (seenHashes.has(hash) || prevHashes.includes(hash)) {
      suspiciousFlags.push('This image has already been submitted');
      hasDuplicate = true;
      imageStatus[idx].status = '⚠ Duplicate';
      sDuplicate = 0;
    }
    seenHashes.add(hash);
  });

  // 3. Timestamp Validation (20 Points)
  if (timeDiffMins !== null && timeDiffMins > 7 * 24 * 60) {
    suspiciousFlags.push('Old image detected');
    sDuration = 0;
  } else {
    sDuration = 20;
  }

  // 4. Evidence Completeness (15 Points)
  if (images.length > 0 && notes && notes.trim().length > 0) {
    sCompleteness = 15;
  }

  // 5. AI Consistency Check (15 Points)
  let aiConsistency = 'Low';
  try {
    if (reqFiles && reqFiles.length > 0 && process.env.OPENROUTER_API_KEY) {
      const file = reqFiles[0];
      const fileBuffer = fs.readFileSync(file.path);
      const base64Image = fileBuffer.toString('base64');
      const mimeType = file.mimetype || 'image/jpeg';

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `The worker completed the task:\n"${currentTask.title}"\nAnalyze these uploaded images.\nDetermine whether they appear consistent with the described completed work.\nAnswer ONLY in JSON.\n{\n"consistency":"High",\n"reason":"Images show harvested tomato plants.",\n"confidence":92\n}`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                }
              ]
            }
          ]
        })
      });
      const data = await response.json();
      let aiText = data.choices[0].message.content;
      aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
      const aiJson = JSON.parse(aiText);
      if (aiJson.consistency === 'High') {
        sAI = 15;
        aiConsistency = 'High';
      } else if (aiJson.consistency === 'Medium') {
        sAI = 10;
        aiConsistency = 'Medium';
      }
    }
  } catch (err) {
    console.error('Error with OpenRouter API:', err);
  }

  const totalScore = sImage + sDuplicate + sDuration + sCompleteness + sAI;

  let riskLevel = '🔴 Needs Manager Review';
  let statusStr = 'Needs Manager Review';
  if (totalScore >= 75) {
    riskLevel = '🟢 Low Risk';
    statusStr = 'Verified';
  }

  return {
    score: totalScore,
    details: {
      images: sImage,
      duplicate: sDuplicate,
      timestamp: sDuration,
      completeness: sCompleteness,
      ai: sAI,
      aiConsistencyStr: aiConsistency,
      status: statusStr,
      hasDuplicate,
      suspiciousFlags,
      recentImage: !(timeDiffMins !== null && timeDiffMins > 7 * 24 * 60)
    },
    imagesWithStatus: imageStatus,
    hasDuplicate,
    riskLevel
  };
}

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
        COALESCE(SUM(COALESCE(sa.payable_wage, COALESCE(s.base_wage, 0))), 0)::numeric AS shift_wage_earned,
        COALESCE(SUM(GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0) * COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0)), 0)::numeric AS overtime_pay
      FROM shift_attendances sa
      LEFT JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.farm_id = $1
        AND sa.worker_id = $2
        AND LOWER(sa.shift_status) IN ('present', 'approved', 'late_present')
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
      'SELECT id, shift_name, start_time, end_time FROM shifts WHERE id = $1 AND farm_id = $2 LIMIT 1',
      [shiftId, farmId]
    );

    if (byId.rows.length > 0) {
      return byId.rows[0];
    }
  }

  const sessionKey = normalizeShiftKey(session);
  if (sessionKey) {
    const byName = await pool.query(
      'SELECT id, shift_name, start_time, end_time FROM shifts WHERE farm_id = $1 AND LOWER(shift_name) = $2 LIMIT 1',
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
      AND t.status IN ('Completed', 'approved')
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
      (farm_id, title, description, crop_cycle_id, livestock_group_id, assigned_to_user_id, created_by_user_id, priority, due_date, status, shift_id, session, shift_start_time, shift_end_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending', $10, $11,
              CASE WHEN $12::time IS NOT NULL AND $9::date IS NOT NULL THEN ($9::date + $12::time) ELSE NULL END,
              CASE WHEN $13::time IS NOT NULL AND $9::date IS NOT NULL THEN ($9::date + $13::time) ELSE NULL END)
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
      normalizeShiftKey(resolvedShift.shift_name),
      resolvedShift.start_time || null,
      resolvedShift.end_time || null
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
          shift_start_time = CASE WHEN $12::time IS NOT NULL AND $7::date IS NOT NULL THEN ($7::date + $12::time) ELSE NULL END,
          shift_end_time = CASE WHEN $13::time IS NOT NULL AND $7::date IS NOT NULL THEN ($7::date + $13::time) ELSE NULL END,
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
      resolvedShift?.start_time || null,
      resolvedShift?.end_time || null
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
      SELECT t.*, u.full_name as assigned_to_name, c.crop_name, l.species as livestock_name,
        latest_update.id as latest_update_id,
        latest_update.notes as latest_update_notes,
        latest_update.images as latest_update_images,
        latest_update.created_at as latest_update_created_at,
        latest_update.progress_percentage as latest_update_progress_percentage,
        latest_update.status as latest_update_status,
        latest_update.verification_score_details as latest_verification_score_details,
        latest_update.risk_level as latest_risk_level,
        latest_update.manager_comment as latest_manager_comment,
        latest_update.ai_confidence as latest_ai_confidence,
        latest_update.verification_result as latest_verification_result,
        latest_update.ai_explanation as latest_ai_explanation,
        latest_update.fraud_summary as latest_fraud_summary,
        latest_update.evidence_completeness as latest_evidence_completeness
      FROM tasks t
      LEFT JOIN app_users u ON t.assigned_to_user_id = u.id
      LEFT JOIN crop_cycles c ON t.crop_cycle_id = c.id
      LEFT JOIN livestock_groups l ON t.livestock_group_id = l.id
      LEFT JOIN LATERAL (
        SELECT tu.*
        FROM task_updates tu
        WHERE tu.task_id = t.id
        ORDER BY tu.created_at DESC
        LIMIT 1
      ) latest_update ON true
      WHERE t.farm_id = $1
      ORDER BY t.created_at DESC
    `, [farmId]);

    const enriched = result.rows.map((task) => {
      const details = safeJsonParse(task.latest_verification_score_details, {});
      const suspiciousFlags = safeJsonParse(task.suspicious_flags, safeJsonParse(details.suspiciousFlags, []));

      return {
        ...task,
        latest_update: task.latest_update_id ? {
          id: task.latest_update_id,
          notes: task.latest_update_notes,
          images: safeJsonParse(task.latest_update_images, []),
          created_at: task.latest_update_created_at,
          progress_percentage: task.latest_update_progress_percentage,
          status: task.latest_update_status,
          verification_score_details: details,
          risk_level: task.latest_risk_level,
          manager_comment: task.latest_manager_comment,
          ai_confidence: task.latest_ai_confidence,
          verification_result: task.latest_verification_result,
          ai_explanation: task.latest_ai_explanation,
          fraud_summary: task.latest_fraud_summary,
          evidence_completeness: task.latest_evidence_completeness,
        } : null,
        verification_score: Number(task.verification_score || details.score || 0),
        suspicious_flags: suspiciousFlags,
        evidence_status: evidenceStateFromScore(Number(task.verification_score || details.score || 0), suspiciousFlags),
      };
    });

    res.json(enriched);
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

    // Fetch the task to check its current status
    const taskRes = await pool.query('SELECT status, title, created_by_user_id FROM tasks WHERE id = $1 AND farm_id = $2 AND assigned_to_user_id = $3', [taskId, farmId, userId]);

    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }

    const currentStatus = taskRes.rows[0].status.toLowerCase();
    const validStartStatuses = ['todo', 'pending', 'assigned', 'accepted'];

    if (!validStartStatuses.includes(currentStatus)) {
      return res.status(400).json({ error: 'Task is not in a valid state to start', currentStatus });
    }

    const result = await pool.query(`
      UPDATE tasks
      SET status = 'in_progress', started_at = NOW(), actual_start_time = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [taskId]);

    const task = result.rows[0];

    // Audit Trail
    await pool.query(`
        INSERT INTO task_timeline (task_id, actor_id, action, previous_status, new_status, reason)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [taskId, userId, 'Start Task', currentStatus, 'in_progress', 'Worker started the shift']);

    // Notification to manager
    const managerId = task.created_by_user_id;
    if (managerId) {
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

        // Emitting socket event for real-time dashboard update
        req.io.to(farmId).emit('task_status_changed', {
          taskId: task.id,
          status: 'in_progress',
          workerId: userId
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
    const { notes, activityType, deviceInfo, networkStatus } = req.body;

    const images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        images.push({
          url: `/uploads/activities/${file.filename}`,
          fileName: file.originalname,
          size: file.size,
          uploadTime: new Date().toISOString(),
          path: file.path,
          mimetype: file.mimetype
        });
      }
    }

    if (images.length < 3 || images.length > 10) {
      return res.status(400).json({ error: 'Evidence requires a minimum of 3 images and a maximum of 10 images.' });
    }

    // Checklist check
    const evidenceCompleteness = {
      notesProvided: !!notes,
      minImagesMet: images.length >= 3
    };
    if (!evidenceCompleteness.notesProvided) {
      return res.status(400).json({ error: 'Completion notes are required.' });
    }

    const taskLookup = await pool.query('SELECT * FROM tasks WHERE id = $1 AND farm_id = $2 AND assigned_to_user_id = $3 AND status = \'In Progress\'', [taskId, farmId, userId]);
    if (taskLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found, unauthorized, or not In Progress' });
    }
    const currentTask = taskLookup.rows[0];

    // Call Strict AI Service
    let verification = await calculateAIEvidenceVerification(images, currentTask);

    if (verification.verificationResult === 'Rejected') {
      // Log the fraudulent attempt into task_updates so the Manager Dashboard can see it
      const countRes = await pool.query('SELECT COUNT(*) FROM task_updates WHERE task_id = $1', [taskId]);
      const updateNumber = parseInt(countRes.rows[0].count, 10) + 1;
      const dbImages = images.map(i => {
        const { path, mimetype, ...rest } = i;
        return rest;
      });

      await pool.query(
        `INSERT INTO task_updates (task_id, farmer_id, notes, activity_type, progress_percentage, device_info, network_status, is_final, images, update_number, status, verification_score, risk_level, ai_confidence, verification_result, ai_explanation, fraud_summary, evidence_completeness) 
         VALUES ($1, $2, $3, $4, 100, $5, $6, true, $7::jsonb, $8, 'Rejected', $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb)`,
        [taskId, userId, notes || null, activityType || 'Final Submission', deviceInfo || null, networkStatus || null, JSON.stringify(dbImages), updateNumber, verification.verificationScore, verification.riskLevel, verification.aiConfidence, verification.verificationResult, verification.aiExplanation, JSON.stringify(verification.fraudSummary), JSON.stringify(evidenceCompleteness)]
      );

      return res.status(400).json({ error: 'Evidence rejected automatically. ' + verification.aiExplanation });
    }

    const result = await pool.query(`
      UPDATE tasks
      SET status = 'Waiting Manager Approval', 
          completed_at = NOW(), 
          end_time = NOW(),
          working_hours = EXTRACT(EPOCH FROM (NOW() - started_at))/3600,
          completion_percentage = 100,
          total_updates = total_updates + 1,
          updated_at = NOW(),
          needs_manager_review = true
      WHERE id = $1 AND farm_id = $2 AND assigned_to_user_id = $3 AND status = 'In Progress'
      RETURNING *
    `, [taskId, farmId, userId]);

    const countRes = await pool.query('SELECT COUNT(*) FROM task_updates WHERE task_id = $1', [taskId]);
    const updateNumber = parseInt(countRes.rows[0].count, 10) + 1;

    const dbImages = images.map(i => {
      const { path, mimetype, ...rest } = i;
      return rest;
    });

    await pool.query(
      `INSERT INTO task_updates (task_id, farmer_id, notes, activity_type, progress_percentage, device_info, network_status, is_final, images, update_number, status, verification_score, risk_level, ai_confidence, verification_result, ai_explanation, fraud_summary, evidence_completeness) 
       VALUES ($1, $2, $3, $4, 100, $5, $6, true, $7::jsonb, $8, 'Waiting for Review', $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb)`,
      [taskId, userId, notes || null, activityType || 'Final Submission', deviceInfo || null, networkStatus || null, JSON.stringify(dbImages), updateNumber, verification.verificationScore, verification.riskLevel, verification.aiConfidence, verification.verificationResult, verification.aiExplanation, JSON.stringify(verification.fraudSummary), JSON.stringify(evidenceCompleteness)]
    );

    // Save image hashes
    for (const imgResult of verification.hashResults) {
      const imgMatch = dbImages.find(di => imgResult.imgPath.endsWith(di.fileName) || di.url.includes(imgResult.imgPath.split(/\\|\//).pop()));
      if (imgMatch) {
        await pool.query(`
            INSERT INTO image_hashes (task_id, update_id, original_file_name, stored_file_name, sha256_hash, phash, file_size, upload_time)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         `, [taskId, updateNumber, imgMatch.fileName, imgMatch.url, imgResult.sha256_hash, imgResult.phash, imgMatch.size]);
      }
    }

    // Audit Log
    await pool.query(`
        INSERT INTO verification_audit_logs (task_id, action, performed_by, reason)
        VALUES ($1, 'Worker Uploaded Evidence', $2, 'Worker submitted task evidence')
    `, [taskId, userId]);

    const task = result.rows[0] || currentTask;
    const managerId = task.created_by_user_id;

    if (managerId) {
      await pool.query(`
        INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        managerId, farmId, 'TASK_EVIDENCE_SUBMITTED', 'Task Ready for Review',
        `Final submission for task: ${task.title}. Risk Level: ${verification.riskLevel}. Waiting for your approval.`, 'high', 'Dashboard'
      ]);
    }

    res.json({ message: 'Task submitted successfully', task, verification });
  } catch (err) {
    console.error('Error submitting evidence:', err);
    res.status(500).json({ error: 'Failed to submit evidence' });
  }
}


export async function getTaskReviews(req, res) {
  try {
    const taskId = req.params.id;
    const farmId = await getDefaultFarmId(req.user.userId);

    // Verify task belongs to farm
    const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1 AND farm_id = $2', [taskId, farmId]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const reviews = await pool.query(`
      SELECT tr.*, u.full_name as manager_name
      FROM task_reviews tr
      JOIN app_users u ON tr.manager_id = u.id
      WHERE tr.task_id = $1
      ORDER BY tr.created_at DESC
    `, [taskId]);

    res.json(reviews.rows);
  } catch (err) {
    console.error('Error fetching task reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
}

export async function getTaskTimeline(req, res) {
  try {
    const taskId = req.params.id;
    const farmId = await getDefaultFarmId(req.user.userId);

    const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1 AND farm_id = $2', [taskId, farmId]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const timelineRes = await pool.query(`
      SELECT
        tt.*,
        u.full_name as actor_name,
        u.role as actor_role
      FROM task_timeline tt
      LEFT JOIN app_users u ON tt.actor_id = u.id
      WHERE tt.task_id = $1
      ORDER BY tt.created_at DESC
    `, [taskId]);

    res.json(timelineRes.rows);
  } catch (err) {
    console.error('Error fetching task timeline:', err);
    res.status(500).json({ error: 'Failed to fetch task timeline' });
  }
}

export async function reviewTask(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const taskId = req.params.id;
    const { action, reason, approvedCompletionPercentage = 100 } = req.body;

    if (!['Approve', 'Reject', 'Request Rework'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (['Reject', 'Request Rework'].includes(action) && !String(reason || '').trim()) {
      return res.status(400).json({ error: 'A comment/reason is required for this action' });
    }

    let status = 'approved';
    if (action === 'Reject') status = 'rejected';
    if (action === 'Request Rework') status = 'rework_requested';

    const taskLookup = await pool.query(`SELECT * FROM tasks WHERE id = $1 AND farm_id = $2 LIMIT 1`, [taskId, farmId]);

    if (taskLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }

    const task = taskLookup.rows[0];

    // Check for Manager Override
    const updateCheck = await pool.query(`SELECT * FROM task_updates WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1`, [taskId]);
    let riskLevel = 'Low Risk';
    let score = 100;
    if (updateCheck.rows.length > 0) {
      const details = typeof updateCheck.rows[0].verification_score_details === 'string' ? JSON.parse(updateCheck.rows[0].verification_score_details || '{}') : (updateCheck.rows[0].verification_score_details || {});
      riskLevel = details.riskLevel || 'Low Risk';
      score = details.score || 100;
    }

    if (action === 'Approve' && (riskLevel === 'High Risk' || riskLevel === 'Medium Risk' || score < 70) && !String(reason || '').trim()) {
      return res.status(400).json({ error: 'A mandatory reason is required to approve a task with High/Medium risk or low verification score.' });
    }

    const result = await pool.query(`
      UPDATE tasks
      SET status = $1, manager_review_notes = $2, manager_reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $3 AND farm_id = $4
      RETURNING *
    `, [status, reason || null, taskId, farmId]);

    const updatedTask = result.rows[0];
    const workerId = task.assigned_to_user_id;
    const attendanceDate = normalizeDateInput(updatedTask.completed_at || updatedTask.end_time || updatedTask.updated_at || new Date()) || new Date().toISOString().slice(0, 10);

    // Increment rework count if not approved
    if (status !== 'approved') {
      await pool.query('UPDATE task_updates SET rework_count = rework_count + 1 WHERE task_id = $1 AND is_final = true', [taskId]);
    }

    // Insert Audit Log for System/Timeline
    await pool.query(`
        INSERT INTO task_timeline (task_id, actor_id, action, previous_status, new_status, reason)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [taskId, userId, 'Manager Review', task.status, status, reason || action]);

    // Insert Strict Evidence Verification Audit Log
    await pool.query(`
        INSERT INTO verification_audit_logs (task_id, action, performed_by, reason)
        VALUES ($1, $2, $3, $4)
    `, [taskId, `Manager ${action}`, userId, reason || 'No reason provided']);

    // If Approved, Mark Attendance
    if (status === 'approved') {
      const checkInTime = updatedTask.started_at || updatedTask.updated_at;
      const checkOutTime = updatedTask.completed_at || updatedTask.updated_at;

      let attendanceStatus = 'present';
      if (task.status === 'late_submission') {
        attendanceStatus = 'late_present';
      }

      // Using shift_attendances which is used by payroll
      // Using shift_attendances which is used by payroll
      const existingAttendance = await pool.query(
        `SELECT id FROM shift_attendances WHERE worker_id = $1 AND shift_id = $3 AND date = $2::date LIMIT 1`,
        [workerId, attendanceDate, updatedTask.shift_id]
      );

      // Fetch full shift wage
      let fullShiftWage = 0;
      if (updatedTask.shift_id) {
        const shiftRes = await pool.query(`SELECT base_wage FROM shifts WHERE id = $1`, [updatedTask.shift_id]);
        if (shiftRes.rows.length > 0) {
          fullShiftWage = shiftRes.rows[0].base_wage || 0;
        }
      }
      
      const payableWage = (Number(fullShiftWage) * (Number(approvedCompletionPercentage) / 100)).toFixed(2);

      if (existingAttendance.rows.length > 0) {
        await pool.query(`
            UPDATE shift_attendances SET check_in_time = $1, check_out_time = $2, total_hours = $3, shift_status = $4, full_shift_wage = $6, approved_completion_percentage = $7, payable_wage = $8, updated_at = NOW() WHERE id = $5
          `, [checkInTime, checkOutTime, updatedTask.working_hours, attendanceStatus, existingAttendance.rows[0].id, fullShiftWage, approvedCompletionPercentage, payableWage]);
      } else {
        await pool.query(`
            INSERT INTO shift_attendances (worker_id, date, shift_id, check_in_time, check_out_time, total_hours, shift_status, farm_id, full_shift_wage, approved_completion_percentage, payable_wage)
            VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [workerId, attendanceDate, updatedTask.shift_id, checkInTime, checkOutTime, updatedTask.working_hours, attendanceStatus, farmId, fullShiftWage, approvedCompletionPercentage, payableWage]);
      }

      await upsertMonthlyPayrollAfterApproval({ farmId, managerId: userId, workerId, effectiveDate: attendanceDate });
    }

    // Notify worker
    await pool.query(`
      INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
      VALUES ($1, $2, $3, $4, $5, 'high', 'Dashboard')
    `, [workerId, farmId, 'TASK_REVIEWED', 'Task Review Completed', `Your task "${updatedTask.title}" has been ${status}.`]);

    if (req.io) {
      req.io.to(workerId).emit('notification', {
        title: 'Task Review Completed',
        message: `Your task "${updatedTask.title}" has been ${status}.`,
        category: 'TASK_REVIEWED',
        priority: 'high'
      });

      req.io.to(farmId).emit('task_status_changed', {
        taskId: task.id,
        status: status,
        workerId: workerId
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

    const taskId = req.query.taskId;

    let query = `
      SELECT tu.id, tu.notes, tu.images, tu.image_url, tu.activity_type, tu.progress_percentage, tu.is_final, tu.created_at, tu.update_number, tu.status as update_status, tu.manager_comment, tu.verification_score_details, tu.risk_level, tu.ai_confidence, tu.verification_result, tu.ai_explanation, tu.fraud_summary, tu.evidence_completeness,
             t.id as task_id, t.title as task_title, t.description as task_description,
             t.status as task_status, t.started_at, t.completed_at, t.working_hours, t.shift_id, t.session,
             t.crop_cycle_id, t.livestock_group_id,
             t.verification_score, t.suspicious_flags, t.needs_manager_review,
             u.id as farmer_id, u.full_name as farmer_name, u.phone as farmer_phone,
             c.crop_name, l.species as livestock_name
      FROM task_updates tu
      JOIN tasks t ON tu.task_id = t.id
      JOIN app_users u ON tu.farmer_id = u.id
      LEFT JOIN crop_cycles c ON t.crop_cycle_id = c.id
      LEFT JOIN livestock_groups l ON t.livestock_group_id = l.id
      WHERE t.farm_id = $1
    `;

    let params = [farmId];
    if (taskId) {
      query += ' AND t.id = $2 ORDER BY tu.created_at DESC LIMIT 50';
      params.push(taskId);
    } else {
      query += ' ORDER BY tu.created_at DESC LIMIT 10';
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent task updates:', err);
    res.status(500).json({ error: 'Failed to fetch task updates' });
  }
}



export async function addActivityUpdate(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const taskId = req.params.id;
    const { notes, activityType, progressPercentage, deviceInfo, networkStatus } = req.body;

    if (!notes || notes.length < 20) {
      return res.status(400).json({ error: 'Description must be at least 20 characters.' });
    }

    const images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        images.push({
          url: `/uploads/activities/${file.filename}`,
          fileName: file.originalname,
          size: file.size,
          uploadTime: new Date().toISOString(),
          path: file.path,
          mimetype: file.mimetype
        });
      }
    }

    if (images.length < 1 || images.length > 5) {
      return res.status(400).json({ error: 'Please upload between 1 and 5 images.' });
    }

    const taskLookup = await pool.query('SELECT * FROM tasks WHERE id = $1 AND farm_id = $2 AND assigned_to_user_id = $3', [taskId, farmId, userId]);
    if (taskLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }
    const currentTask = taskLookup.rows[0];

    const prevUpdatesRes = await pool.query('SELECT images FROM task_updates WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1', [taskId]);
    let prevImages = [];
    if (prevUpdatesRes.rows.length > 0 && prevUpdatesRes.rows[0].images) {
      prevImages = typeof prevUpdatesRes.rows[0].images === 'string' ? JSON.parse(prevUpdatesRes.rows[0].images) : prevUpdatesRes.rows[0].images;
    }

    // Call AI Service
    let verification = await calculateAIEvidenceVerification(images, currentTask, false);

    const countRes = await pool.query('SELECT COUNT(*) FROM task_updates WHERE task_id = $1', [taskId]);
    const updateNumber = parseInt(countRes.rows[0].count, 10) + 1;

    const dbImages = images.map(i => {
      const { path, mimetype, ...rest } = i;
      return rest;
    });

    const evidenceCompleteness = {
      notesProvided: !!notes,
      minImagesMet: images.length >= 1
    };

    if (verification.verificationResult === 'Rejected') {
      await pool.query(
        `INSERT INTO task_updates (task_id, farmer_id, notes, activity_type, progress_percentage, device_info, network_status, is_final, images, update_number, status, verification_score, risk_level, ai_confidence, verification_result, ai_explanation, fraud_summary, evidence_completeness) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8::jsonb, $9, 'Rejected', $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb)`,
        [taskId, userId, notes || null, activityType || 'Activity Update', parseInt(progressPercentage, 10) || 0, deviceInfo || null, networkStatus || null, JSON.stringify(dbImages), updateNumber, verification.verificationScore, verification.riskLevel, verification.aiConfidence, verification.verificationResult, verification.aiExplanation, JSON.stringify(verification.fraudSummary), JSON.stringify(evidenceCompleteness)]
      );

      return res.status(400).json({ error: 'Evidence rejected automatically. ' + verification.aiExplanation });
    }

    const newCompletion = parseInt(progressPercentage, 10) || 0;
    const isFinalUpdate = req.body.isFinal === 'true' || newCompletion >= 100;

    const insertRes = await pool.query(
      `INSERT INTO task_updates (task_id, farmer_id, notes, activity_type, progress_percentage, device_info, network_status, is_final, images, update_number, status, verification_score, risk_level, ai_confidence, verification_result, ai_explanation, fraud_summary, evidence_completeness) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, 'Waiting for Review', $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb) RETURNING *`,
      [taskId, userId, notes || null, activityType || 'Activity Update', newCompletion, deviceInfo || null, networkStatus || null, isFinalUpdate, JSON.stringify(dbImages), updateNumber, verification.verificationScore, verification.riskLevel, verification.aiConfidence, verification.verificationResult, verification.aiExplanation, JSON.stringify(verification.fraudSummary), JSON.stringify(evidenceCompleteness)]
    );

    // Save image hashes
    for (const imgResult of (verification.hashResults || [])) {
      const imgMatch = dbImages.find(di => imgResult.imgPath.endsWith(di.fileName) || di.url.includes(imgResult.imgPath.split(/\\|\//).pop()));
      if (imgMatch) {
        await pool.query(`
            INSERT INTO image_hashes (task_id, update_id, original_file_name, stored_file_name, sha256_hash, phash, file_size, upload_time)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         `, [taskId, updateNumber, imgMatch.fileName, imgMatch.url, imgResult.sha256_hash, imgResult.phash, imgMatch.size]);
      }
    }

    if (isFinalUpdate) {
      await pool.query(
        'UPDATE tasks SET status = $1, completion_percentage = $2, total_updates = total_updates + 1, updated_at = NOW() WHERE id = $3 AND farm_id = $4',
        ['waiting_manager_approval', 100, taskId, farmId]
      );
    } else {
      await pool.query(
        'UPDATE tasks SET completion_percentage = GREATEST(completion_percentage, $1), total_updates = total_updates + 1, updated_at = NOW() WHERE id = $2 AND farm_id = $3',
        [newCompletion, taskId, farmId]
      );
    }

    if (currentTask.created_by_user_id) {
      await pool.query(`
          INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
          VALUES ($1, $2, $3, $4, $5, 'normal', 'Dashboard')
       `, [currentTask.created_by_user_id, farmId, 'ACTIVITY_UPDATE', 'New Activity Update', `New update (${progressPercentage}%) for task: ${currentTask.title}`]);
    }

    await pool.query(`
        INSERT INTO task_timeline (task_id, actor_id, action, previous_status, new_status, reason)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [taskId, userId, isFinalUpdate ? 'Submit Evidence' : 'Activity Update', currentTask.status, isFinalUpdate ? 'waiting_manager_approval' : currentTask.status, 'Submitted evidence/update from mobile app']);

    res.status(201).json({ message: 'Activity update submitted successfully', update: insertRes.rows[0], verification });
  } catch (err) {
    console.error('Error adding activity update:', err);
    res.status(500).json({ error: 'Failed to add activity update' });
  }
}


export async function reviewTaskUpdate(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const updateId = req.params.updateId;
    const { action, reason, priority, remainingPercentage, approvedPercentage } = req.body;

    if (!['Approve', 'Request Rework', 'Reject Update'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (['Request Rework', 'Reject Update'].includes(action) && !String(reason || '').trim()) {
      return res.status(400).json({ error: 'A reason is required for this action' });
    }

    const updateLookup = await pool.query(`
      SELECT tu.*, t.id as task_id, t.title as task_title, t.task_wage, t.assigned_to_user_id, t.shift_id
      FROM task_updates tu
      JOIN tasks t ON tu.task_id = t.id
      WHERE tu.id = $1 AND t.farm_id = $2 LIMIT 1
    `, [updateId, farmId]);

    if (updateLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Update not found or unauthorized' });
    }

    const update = updateLookup.rows[0];
    let newStatus = 'Approved';
    if (action === 'Request Rework') newStatus = 'Rework Required';
    if (action === 'Reject Update') newStatus = 'Rejected';

    await pool.query(`
      UPDATE task_updates
      SET status = $1, manager_comment = $2, updated_at = NOW()
      WHERE id = $3
    `, [newStatus, reason || null, updateId]);

    if (newStatus === 'Approved') {
      const prog = approvedPercentage !== undefined ? parseInt(approvedPercentage, 10) : parseInt(update.progress_percentage || 0, 10);
      const earnedAmount = (Number(update.task_wage || 0) * prog) / 100;

      await pool.query(`
        UPDATE task_updates SET approved_progress = $1 WHERE id = $2
      `, [prog, updateId]);

      await pool.query(`
        UPDATE tasks 
        SET approved_progress = approved_progress + $1,
            earned_salary = earned_salary + $2,
            completion_percentage = GREATEST(completion_percentage, $1),
            needs_manager_review = false
        WHERE id = $3
      `, [prog, earnedAmount, update.task_id]);

      // Create Ledger Entry
      await pool.query(`
        INSERT INTO salary_ledger (farm_id, worker_id, task_id, task_update_id, approved_progress, amount)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [farmId, update.assigned_to_user_id, update.task_id, updateId, prog, earnedAmount]);

      // Update shift_attendances to reflect payable wage
      if (update.shift_id) {
        const attendanceDate = normalizeDateInput(update.created_at) || new Date().toISOString().slice(0, 10);
        const shiftRes = await pool.query(`SELECT base_wage FROM shifts WHERE id = $1`, [update.shift_id]);
        let fullShiftWage = 0;
        if (shiftRes.rows.length > 0) {
          fullShiftWage = shiftRes.rows[0].base_wage || 0;
        }
        const payableWage = (Number(fullShiftWage) * (Number(prog) / 100)).toFixed(2);

        // Check if attendance exists
        const existingAttendance = await pool.query(
          `SELECT id FROM shift_attendances WHERE worker_id = $1 AND shift_id = $2 AND date = $3::date LIMIT 1`,
          [update.assigned_to_user_id, update.shift_id, attendanceDate]
        );

        if (existingAttendance.rows.length > 0) {
          await pool.query(`
            UPDATE shift_attendances 
            SET full_shift_wage = $1, approved_completion_percentage = $2, payable_wage = $3, shift_status = 'Present', updated_at = NOW()
            WHERE id = $4
          `, [fullShiftWage, prog, payableWage, existingAttendance.rows[0].id]);
        } else {
          // If not exists, insert it
          const checkInTime = update.created_at || new Date();
          const checkOutTime = update.created_at || new Date();
          await pool.query(`
            INSERT INTO shift_attendances (
              worker_id, date, shift_id, check_in_time, check_out_time, total_hours, shift_status, farm_id, full_shift_wage, approved_completion_percentage, payable_wage
            ) VALUES ($1, $2::date, $3, $4, $5, 0, 'Present', $6, $7, $8, $9)
          `, [
            update.assigned_to_user_id,
            attendanceDate,
            update.shift_id,
            checkInTime,
            checkOutTime,
            farmId,
            fullShiftWage,
            prog,
            payableWage
          ]);
        }

        // Rebuild monthly payroll summary so it is immediately updated
        await upsertMonthlyPayrollAfterApproval({
          farmId,
          managerId: userId,
          workerId: update.assigned_to_user_id,
          effectiveDate: attendanceDate,
        });
      }

      // We don't call upsertMonthlyPayrollAfterApproval directly here because dynamic payroll runs off salary_ledger
      // But we can trigger a worker notification
    }

    if (newStatus === 'Rework Required') {
      await pool.query(`
        UPDATE tasks
        SET completion_percentage = 0,
            approved_progress = 0,
            earned_salary = 0,
            needs_manager_review = true,
            updated_at = NOW()
        WHERE id = $1 AND farm_id = $2
      `, [update.task_id, farmId]);

      await pool.query(`
        UPDATE task_updates
        SET approved_progress = 0,
            manager_comment = $2,
            updated_at = NOW()
        WHERE id = $1
      `, [updateId, reason || null]);
    }

    if (newStatus === 'Rejected') {
      await pool.query(`
        UPDATE tasks
        SET completion_percentage = 0,
            approved_progress = 0,
            earned_salary = 0,
            needs_manager_review = false,
            updated_at = NOW()
        WHERE id = $1 AND farm_id = $2
      `, [update.task_id, farmId]);

      await pool.query(`
        UPDATE task_updates
        SET approved_progress = 0,
            manager_comment = $2,
            updated_at = NOW()
        WHERE id = $1
      `, [updateId, reason || null]);
    }

    res.json({ message: `Update ${newStatus} successfully` });
  } catch (err) {
    console.error('Error reviewing task update:', err);
    res.status(500).json({ error: 'Failed to review task update' });
  }
}

export async function getTaskEvidence(req, res) {
  try {
    const taskId = req.params.id;
    // Fetch the latest task_update that has images/evidence
    const evidenceRes = await pool.query(
      'SELECT * FROM task_updates WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1',
      [taskId]
    );
    res.json(evidenceRes.rows[0] || null);
  } catch (err) {
    console.error('Error fetching task evidence:', err);
    res.status(500).json({ error: 'Failed to fetch task evidence' });
  }
}
export async function getWorkerVerificationHistory(req, res) {
  try {
    const { workerId } = req.params;
    const farmId = await getDefaultFarmId(req.user.userId);

    const tasksRes = await pool.query(`
      SELECT t.id, t.status 
      FROM tasks t 
      WHERE t.assigned_to_user_id = $1 AND t.farm_id = $2
    `, [workerId, farmId]);

    if (tasksRes.rows.length === 0) {
      return res.json({ successRate: 0, avgScore: 0, reworkCount: 0, rejectedCount: 0, previousSubmissions: 0, lateSubmissions: 0 });
    }

    const taskIds = tasksRes.rows.map(t => t.id);
    const updatesRes = await pool.query(`
      SELECT verification_score_details, rework_count, created_at, status 
      FROM task_updates 
      WHERE task_id = ANY($1)
    `, [taskIds]);

    let totalScore = 0;
    let scoredUpdates = 0;
    let totalReworks = 0;

    updatesRes.rows.forEach(u => {
      const details = typeof u.verification_score_details === 'string' ? JSON.parse(u.verification_score_details || '{}') : (u.verification_score_details || {});
      if (details.score !== undefined) {
        totalScore += Number(details.score);
        scoredUpdates++;
      }
      if (u.rework_count) {
        totalReworks += Number(u.rework_count);
      }
    });

    const avgScore = scoredUpdates > 0 ? Math.round(totalScore / scoredUpdates) : 0;
    const completedTasks = tasksRes.rows.filter(t => t.status === 'completed' || t.status === 'approved').length;
    const rejectedTasks = tasksRes.rows.filter(t => t.status === 'rejected' || t.status === 'invalid' || t.status === 'failed').length;
    const totalReviewed = completedTasks + rejectedTasks;
    const successRate = totalReviewed > 0 ? Math.round((completedTasks / totalReviewed) * 100) : 0;
    const lateSubmissions = tasksRes.rows.filter(t => t.status === 'late_submission').length;

    res.json({
      successRate,
      avgScore,
      reworkCount: totalReworks,
      rejectedCount: rejectedTasks,
      previousSubmissions: tasksRes.rows.length,
      lateSubmissions
    });
  } catch (err) {
    console.error('Error fetching worker history:', err);
    res.status(500).json({ error: 'Failed to fetch worker history' });
  }
}

export async function getEvidenceVersions(req, res) {
  try {
    const taskId = req.params.id;
    const farmId = await getDefaultFarmId(req.user.userId);

    const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1 AND farm_id = $2', [taskId, farmId]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updates = await pool.query(`
      SELECT * 
      FROM task_updates 
      WHERE task_id = $1
      ORDER BY created_at DESC
    `, [taskId]);

    res.json(updates.rows);
  } catch (err) {
    console.error('Error fetching evidence versions:', err);
    res.status(500).json({ error: 'Failed to fetch evidence versions' });
  }
}
