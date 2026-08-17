import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';
import { syncAttendanceFromCompletedTasks } from './taskController.js';
import { calculatePayrollMetrics, daysInMonth } from '../utils/payrollMath.js';

function getMonthYearFromQuery(req) {
  const now = new Date();
  const month = Number(req.query.month || now.getMonth() + 1);
  const year = Number(req.query.year || now.getFullYear());
  return { month, year, paymentMonth: `${year}-${String(month).padStart(2, '0')}` };
}

export const getMonthlyAttendance = async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const { month, year, workerId } = req.query; // YYYY-MM format expected or separate

    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    await syncAttendanceFromCompletedTasks({
      farmId,
      workerId: workerId || null,
      month: Number(month),
      year: Number(year),
    });

    let query = `
      SELECT id, worker_id, date, shift_id, check_in_time, check_out_time, total_hours, shift_status
      FROM shift_attendances
      WHERE farm_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3
    `;
    const params = [farmId, month, year];

    if (workerId) {
      query += ` AND worker_id = $4`;
      params.push(workerId);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Server error fetching attendance' });
  }
};

export const getMyAttendance = async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const { month, year, paymentMonth } = getMonthYearFromQuery(req);

    await syncAttendanceFromCompletedTasks({
      farmId,
      workerId: userId,
      month,
      year,
    });

    const [attendanceRes, todayRes, paymentRes] = await Promise.all([
      pool.query(`
        SELECT
          sa.id,
          sa.date,
          sa.check_in_time,
          sa.check_out_time,
          sa.total_hours,
          sa.shift_status,
          t.title as task_title,
          COALESCE(s.shift_name, t.session::text) as session,
          sa.full_shift_wage,
          sa.approved_completion_percentage,
          sa.payable_wage,
          ROUND(
            CASE WHEN LOWER(sa.shift_status) = 'absent' THEN 0
            ELSE COALESCE(sa.payable_wage, COALESCE(s.base_wage, 0)) END
          ::numeric, 2) as shift_wage_earned,
          ROUND(
            CASE WHEN LOWER(sa.shift_status) = 'absent' THEN 0
            ELSE GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0)
            * COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0) END
          ::numeric, 2) as overtime_pay
        FROM shift_attendances sa
        LEFT JOIN shifts s ON sa.shift_id = s.id
        LEFT JOIN tasks t ON t.assigned_to_user_id = sa.worker_id
          AND (t.shift_id = sa.shift_id OR (t.shift_id IS NULL AND sa.shift_id IS NULL))
          AND DATE(COALESCE(t.completed_at, t.end_time, t.updated_at)) = DATE(sa.date)
        WHERE sa.farm_id = $1
          AND sa.worker_id = $2
          AND EXTRACT(MONTH FROM sa.date) = $3
          AND EXTRACT(YEAR FROM sa.date) = $4
        ORDER BY sa.date DESC, sa.created_at DESC
      `, [farmId, userId, month, year]),
      pool.query(`
        SELECT
          sa.id,
          sa.date,
          sa.check_in_time,
          sa.check_out_time,
          sa.total_hours,
          sa.shift_status,
          t.title as task_title,
          COALESCE(s.shift_name, t.session::text) as session,
          ROUND(
            CASE WHEN LOWER(sa.shift_status) = 'absent' THEN 0
            ELSE COALESCE(s.base_wage, 0) END
          ::numeric, 2) as shift_wage_earned,
          ROUND(
            CASE WHEN LOWER(sa.shift_status) = 'absent' THEN 0
            ELSE GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0)
            * COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0) END
          ::numeric, 2) as overtime_pay
        FROM shift_attendances sa
        LEFT JOIN shifts s ON sa.shift_id = s.id
        LEFT JOIN tasks t ON t.assigned_to_user_id = sa.worker_id
          AND (t.shift_id = sa.shift_id OR (t.shift_id IS NULL AND sa.shift_id IS NULL))
          AND DATE(COALESCE(t.completed_at, t.end_time, t.updated_at)) = DATE(sa.date)
        WHERE sa.farm_id = $1
          AND sa.worker_id = $2
          AND DATE(sa.date) = CURRENT_DATE
        ORDER BY sa.created_at DESC
        LIMIT 1
      `, [farmId, userId]),
      pool.query(`
        SELECT *
        FROM monthly_salary_payments
        WHERE farm_id = $1 AND worker_id = $2 AND payment_month = $3
        ORDER BY created_at DESC
        LIMIT 1
      `, [farmId, userId, paymentMonth]),
    ]);

    const payment = paymentRes.rows[0] || {};
    const metrics = calculatePayrollMetrics(attendanceRes.rows, {
      month,
      year,
      bonus: Number(payment.bonus ?? payment.bonus_amount ?? 0),
      deductions: Number(payment.deductions ?? 0),
    });

    res.json({
      summary: metrics,
      todayAttendance: todayRes.rows[0] || null,
      attendances: attendanceRes.rows,
      payroll: payment,
    });
  } catch (err) {
    console.error('Error fetching my attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

export const getManagerAttendance = async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const { month, year } = getMonthYearFromQuery(req);
    const { workerId, search, date, shiftId } = req.query;

    try {
      await syncAttendanceFromCompletedTasks({
        farmId,
        workerId: workerId || null,
        month,
        year,
        managerId: userId,
      });
    } catch (syncErr) {
      console.error('Non-fatal error syncing attendance from tasks:', syncErr);
    }

    const filters = [
      `sa.farm_id = $1`,
      `EXTRACT(MONTH FROM sa.date) = $2`,
      `EXTRACT(YEAR FROM sa.date) = $3`,
    ];
    const params = [farmId, month, year];

    if (workerId) {
      params.push(workerId);
      filters.push(`sa.worker_id = $${params.length}`);
    }
    if (date) {
      params.push(date);
      filters.push(`DATE(sa.date) = $${params.length}::date`);
    }
    if (shiftId) {
      params.push(shiftId);
      filters.push(`sa.shift_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${String(search).trim()}%`);
      filters.push(`LOWER(u.full_name) LIKE LOWER($${params.length})`);
    }

    const [attendanceRes, workersRes, calendarRes, totalWorkersRes, completedTasksRes] = await Promise.all([
      pool.query(`
        SELECT
          sa.id,
          sa.worker_id,
          u.full_name as worker_name,
          sa.date,
          sa.shift_id,
          COALESCE(s.shift_name, 'Unknown') as shift_name,
          sa.check_in_time,
          sa.check_out_time,
          sa.total_hours,
          sa.shift_status,
          t.title as task_title,
          sa.full_shift_wage,
          sa.approved_completion_percentage,
          sa.payable_wage,
          ROUND(
            CASE WHEN LOWER(sa.shift_status) = 'absent' THEN 0
            ELSE COALESCE(sa.payable_wage, COALESCE(s.base_wage, 0)) END
          ::numeric, 2) as shift_wage_earned,
          ROUND(
            CASE WHEN LOWER(sa.shift_status) = 'absent' THEN 0
            ELSE GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0)
            * COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0) END
          ::numeric, 2) as overtime_pay
        FROM shift_attendances sa
        JOIN app_users u ON sa.worker_id = u.id
        LEFT JOIN shifts s ON sa.shift_id = s.id
        LEFT JOIN tasks t ON t.assigned_to_user_id = sa.worker_id
          AND (t.shift_id = sa.shift_id OR (t.shift_id IS NULL AND sa.shift_id IS NULL))
          AND DATE(COALESCE(t.completed_at, t.end_time, t.updated_at)) = DATE(sa.date)
        WHERE ${filters.join(' AND ')}
        ORDER BY sa.date DESC, sa.created_at DESC
      `, params),
      pool.query(`
        SELECT
          u.id as worker_id,
          u.full_name as worker_name,
          SUM(CASE WHEN LOWER(COALESCE(sa.shift_status, '')) != 'absent' THEN 1 ELSE 0 END)::int as completed_shifts,
          COUNT(DISTINCT CASE WHEN LOWER(COALESCE(sa.shift_status, '')) != 'absent' THEN DATE(sa.date) ELSE NULL END)::int as active_days,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(sa.shift_status, '')) != 'absent' THEN COALESCE(sa.total_hours, 0) ELSE 0 END), 0)::numeric as total_working_hours,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(sa.shift_status, '')) != 'absent' AND LOWER(COALESCE(s.shift_name, '')) = 'morning' THEN 1 ELSE 0 END), 0)::int as morning_shifts,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(sa.shift_status, '')) != 'absent' AND LOWER(COALESCE(s.shift_name, '')) = 'afternoon' THEN 1 ELSE 0 END), 0)::int as afternoon_shifts,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(sa.shift_status, '')) != 'absent' AND LOWER(COALESCE(s.shift_name, '')) = 'evening' THEN 1 ELSE 0 END), 0)::int as evening_shifts
        FROM shift_attendances sa
        JOIN app_users u ON sa.worker_id = u.id
        LEFT JOIN shifts s ON sa.shift_id = s.id
        WHERE ${filters.join(' AND ')}
        GROUP BY u.id, u.full_name
        ORDER BY u.full_name ASC
      `, params),
      pool.query(`
        SELECT
          date,
          COUNT(*)::int as shift_count,
          SUM(CASE WHEN shift_status IN ('Present', 'Approved') THEN 1 ELSE 0 END)::int as present_count
        FROM shift_attendances
        WHERE ${workerId ? 'farm_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3 AND worker_id = $4' : 'farm_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3'}
        GROUP BY date
        ORDER BY date ASC
      `, workerId ? [farmId, month, year, workerId] : [farmId, month, year]),
      pool.query(`
        SELECT COUNT(DISTINCT sa.worker_id)::int AS total_workers
        FROM shift_attendances sa
        JOIN app_users u ON sa.worker_id = u.id
        WHERE ${filters.join(' AND ')}
      `, params),
      pool.query(`
        SELECT COUNT(*)::int AS total_completed_tasks
        FROM tasks
        WHERE farm_id = $1
          AND status = 'Completed'
          AND EXTRACT(MONTH FROM COALESCE(completed_at, end_time, updated_at)) = $2
          AND EXTRACT(YEAR FROM COALESCE(completed_at, end_time, updated_at)) = $3
      `, [farmId, month, year]),
    ]);

    const metrics = calculatePayrollMetrics(attendanceRes.rows, {
      month,
      year,
      bonus: 0,
      deductions: 0,
    });

    console.log('getManagerAttendance request:', { farmId, month, year, search, filters, params });

    const summaryPayload = {
      ...metrics,
      total_workers: totalWorkersRes.rows[0]?.total_workers || 0,
      completed_tasks: completedTasksRes.rows[0]?.total_completed_tasks || 0,
      total_days_in_month: daysInMonth(month, year),
    };
    console.log('getManagerAttendance summary:', summaryPayload);

    res.json({
      summary: summaryPayload,
      attendances: attendanceRes.rows,
      workers: workersRes.rows,
      calendar: calendarRes.rows,
    });
  } catch (err) {
    console.error('Error fetching manager attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance management data' });
  }
};

export const getWorkerAttendanceProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const workerId = req.params.workerId;

    // A comprehensive query to get worker's performance profile stats
    const query = `
      SELECT 
        COUNT(*) as total_shifts,
        SUM(CASE WHEN shift_status IN ('Present', 'Approved') THEN 1 ELSE 0 END) as approved_shifts,
        SUM(total_hours) as total_working_hours,
        SUM(CASE WHEN check_in_time > (date + s.start_time) + INTERVAL '15 minutes' THEN 1 ELSE 0 END) as late_starts
      FROM shift_attendances sa
      LEFT JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.worker_id = $1 AND sa.farm_id = $2
    `;

    const result = await pool.query(query, [workerId, farmId]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching worker profile:', err);
    res.status(500).json({ error: 'Server error fetching worker profile' });
  }
};
