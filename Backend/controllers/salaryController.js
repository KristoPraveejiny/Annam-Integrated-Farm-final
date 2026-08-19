import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';
import { syncAttendanceFromCompletedTasks } from './taskController.js';
import { calculatePayrollMetrics } from '../utils/payrollMath.js';
import { sendEmail } from '../services/emailService.js';
import { randomUUID } from 'crypto';
import { getPayoutProvider } from '../services/payoutProvider.js';

function getMonthYearFromQuery(req) {
  const now = new Date();
  const month = Number(req.query.month || now.getMonth() + 1);
  const year = Number(req.query.year || now.getFullYear());
  const paymentMonth = `${year}-${String(month).padStart(2, '0')}`;
  return { month, year, paymentMonth };
}

async function ensureSalaryAdvanceTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS salary_advances (
      id uuid PRIMARY KEY,
      farm_id uuid NOT NULL,
      worker_id uuid NOT NULL,
      manager_id uuid NULL,
      payroll_month text NOT NULL,
      amount numeric(12,2) NOT NULL DEFAULT 0,
      reason text NOT NULL,
      status text NOT NULL DEFAULT 'Pending',
      manager_notes text NULL,
      payment_method text NULL,
      account_details text NULL,
      payment_status text NOT NULL DEFAULT 'Pending',
      requested_at timestamptz NOT NULL DEFAULT NOW(),
      reviewed_at timestamptz NULL,
      deducted_from_payment_id uuid NULL
    )
  `);
  await pool.query(`
    ALTER TABLE salary_advances
    ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'Pending'
  `);
}

export async function getFarmerSalaryStats(farmId, workerId, payrollMonth) {
  await ensureSalaryAdvanceTable();
  
  // 1. Get net_salary from monthly_salary_payments if it exists
  const paymentRes = await pool.query(
    `SELECT net_salary, gross_salary, deductions, id FROM monthly_salary_payments 
     WHERE farm_id = $1 AND worker_id = $2 AND payment_month = $3`,
    [farmId, workerId, payrollMonth]
  );
  
  let netSalary = 0;
  let grossSalary = 0;
  let hasPayroll = false;
  let payrollId = null;

  if (paymentRes.rows.length > 0) {
    netSalary = Number(paymentRes.rows[0].net_salary || 0);
    grossSalary = Number(paymentRes.rows[0].gross_salary || 0);
    hasPayroll = true;
    payrollId = paymentRes.rows[0].id;
  } else {
    // If payroll is not generated yet, calculate it dynamically based on attendance
    const [year, monthStr] = payrollMonth.split('-');
    const yearNum = Number(year);
    const monthNum = Number(monthStr);

    const attendances = await pool.query(`
      SELECT
        sa.*,
        s.shift_name,
        s.base_wage,
        s.hourly_rate,
        s.standard_hours,
        s.overtime_rate,
        ROUND(COALESCE(s.base_wage, 0)::numeric, 2) AS shift_wage_earned,
        ROUND(COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0)::numeric, 2) AS derived_hourly_rate,
        ROUND(
          GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0)
          * COALESCE(s.overtime_rate, 0)
        ::numeric, 2) AS overtime_pay
      FROM shift_attendances sa
      LEFT JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.farm_id = $1
        AND sa.worker_id = $2
        AND sa.shift_status IN ('Present', 'Approved')
        AND EXTRACT(MONTH FROM sa.date) = $3
        AND EXTRACT(YEAR FROM sa.date) = $4
    `, [farmId, workerId, monthNum, yearNum]);

    const ledgerRes = await pool.query(`
      SELECT COALESCE(SUM(amount), 0)::numeric AS total
      FROM salary_ledger
      WHERE farm_id = $1 AND worker_id = $2
        AND EXTRACT(MONTH FROM created_at) = $3
        AND EXTRACT(YEAR FROM created_at) = $4
    `, [farmId, workerId, monthNum, yearNum]);
    const ledgerEarnings = Number(ledgerRes.rows[0].total || 0);

    const metrics = calculatePayrollMetrics(attendances.rows, { month: monthNum, year: yearNum, deductions: 0 });
    netSalary = metrics.netSalary + ledgerEarnings;
    grossSalary = metrics.grossSalary + ledgerEarnings;
  }

  // 2. Calculate total successful PAID advances for that month.
  const advanceRes = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS total
     FROM salary_advances
     WHERE farm_id = $1 AND worker_id = $2 AND payroll_month = $3 AND (status = 'Paid' OR payment_status = 'Paid')`,
    [farmId, workerId, payrollMonth]
  );
  const alreadyPaidAdvances = Number(advanceRes.rows[0].total || 0);

  // 3. Calculate total successful partial salary payments.
  let alreadyPaidSalary = 0;
  if (payrollId) {
    const partialRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM salary_transactions
       WHERE payroll_id = $1 AND payment_type IN ('Partial Salary', 'Final Salary') AND payment_status = 'Paid'`,
      [payrollId]
    );
    alreadyPaidSalary = Number(partialRes.rows[0].total || 0);
    console.log(`DEBUG getFarmerSalaryStats: payrollId=${payrollId}, alreadyPaidSalary=${alreadyPaidSalary}`);
  }

  const remainingPayable = Math.max(0, netSalary - alreadyPaidAdvances - alreadyPaidSalary);

  return {
    net_salary: netSalary,
    gross_salary: grossSalary,
    advance_paid: alreadyPaidAdvances,
    partial_paid: alreadyPaidSalary,
    remaining_payable: remainingPayable,
    has_payroll: hasPayroll,
    payroll_id: payrollId
  };
}

function maskAccount(account) {
  const value = String(account || '').replace(/\s+/g, '');
  return value.length > 4 ? `**** **** ${value.slice(-4)}` : 'Farm account not configured';
}

export const getPayoutConfig = async (req, res) => {
  res.json({
    mode: 'DEVELOPMENT / TEST MODE',
    sourceAccount: maskAccount(process.env.FARM_DEFAULT_BANK_ACCOUNT),
  });
};

async function getApprovedAdvanceTotal({ farmId, workerId, payrollMonth }) {
  await ensureSalaryAdvanceTable();
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS total
     FROM salary_advances
     WHERE farm_id = $1 AND worker_id = $2 AND payroll_month = $3 AND (status = 'Paid' OR payment_status = 'Paid')`,
    [farmId, workerId, payrollMonth]
  );
  return Number(result.rows[0]?.total || 0);
}


async function notifyPayrollStakeholders(req, { farmId, workerId, title, message, category = 'PAYROLL', emailSubject, emailHtml, emailText }) {
  const userRes = await pool.query(`SELECT id, email, phone FROM app_users WHERE id = $1 LIMIT 1`, [workerId]);
  const user = userRes.rows[0];

  await pool.query(`
    INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [workerId, farmId || null, category, title, message, 'high', 'Dashboard']);

  if (req.io) {
    req.io.to(workerId).emit('notification', {
      title,
      message,
      category,
    });
  }

  if (user?.email && emailSubject) {
    await sendEmail({
      to: user.email,
      subject: emailSubject,
      html: emailHtml || `<p>${message}</p>`,
      text: emailText || message,
    });
  }

  if (user?.phone) {
    console.log(`SMS to ${user.phone}: ${message}`);
  }
}

export const generateMonthlyPayroll = async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const { month, year } = req.body; // e.g., month = 7, year = 2026

    // First check if payroll already generated for this month
    const existing = await pool.query(
      `SELECT * FROM monthly_salary_payments WHERE farm_id = $1 AND payment_month = $2`,
      [farmId, `${year}-${month.toString().padStart(2, '0')}`]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Payroll already generated for this month. Please update instead.' });
    }

    // Get all approved shift attendances for the month
    const attendances = await pool.query(`
      SELECT
        sa.*,
        s.shift_name,
        s.base_wage,
        s.hourly_rate,
        s.standard_hours,
        s.overtime_rate,
        ROUND(COALESCE(s.base_wage, 0)::numeric, 2) AS shift_wage_earned,
        ROUND(COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0)::numeric, 2) AS derived_hourly_rate,
        ROUND(
          GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0)
          * COALESCE(s.overtime_rate, 0)
        ::numeric, 2) AS overtime_pay
      FROM shift_attendances sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.farm_id = $1
        AND sa.shift_status IN ('Present', 'Approved')
        AND EXTRACT(MONTH FROM sa.date) = $2
        AND EXTRACT(YEAR FROM sa.date) = $3
    `, [farmId, month, year]);

    // Aggregate by worker
    const workerStats = {};

    attendances.rows.forEach(record => {
      const wId = record.worker_id;
      if (!workerStats[wId]) {
        workerStats[wId] = [];
      }
      workerStats[wId].push(record);
    });

    const paymentMonthString = `${year}-${month.toString().padStart(2, '0')}`;
    const generatedRecords = [];

    for (const [wId, ws] of Object.entries(workerStats)) {
      const stats = await getFarmerSalaryStats(farmId, wId, paymentMonthString);
      const metrics = calculatePayrollMetrics(ws, { month, year, deductions: 0 });
      const gross = stats.gross_salary;
      const net = stats.net_salary;
      const finalAmount = Math.max(0, net - stats.advance_paid);
      const initialStatus = stats.advance_paid > 0 ? 'PARTIALLY PAID' : 'Pending';

      const resInsert = await pool.query(`
        INSERT INTO monthly_salary_payments (
          farm_id, worker_id, manager_id, payment_month,
          present_days, half_days, leaves, morning_shifts, afternoon_shifts, evening_shifts,
          total_working_hours, overtime, base_salary, hourly_wage_total,
          gross_salary, net_salary, payment_status, advance_paid, partial_paid, final_payment_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 0, $19)
        RETURNING *
      `, [
        farmId, wId, userId, paymentMonthString,
        metrics.completedShifts, metrics.halfDays, 0, metrics.morningShifts, metrics.afternoonShifts, metrics.eveningShifts,
        metrics.totalWorkingHours, metrics.overtimePay, metrics.shiftWageEarned, 0,
        gross, net, initialStatus, stats.advance_paid, finalAmount
      ]);

      const paymentId = resInsert.rows[0].id;

      // Link any previously paid advances for this month to this payroll payment
      await pool.query(`
        UPDATE salary_advances
        SET deducted_from_payment_id = $1
        WHERE farm_id = $2 AND worker_id = $3 AND payroll_month = $4 AND (status = 'Paid' OR payment_status = 'Paid')
      `, [paymentId, farmId, wId, paymentMonthString]);

      generatedRecords.push(resInsert.rows[0]);

      // Notify worker
      await pool.query(`
        INSERT INTO notifications (user_id, title, message, category, delivery_channel)
        VALUES ($1, 'Salary Generated', 'Your salary for ${paymentMonthString} has been generated.', 'PAYROLL', '["Dashboard"]')
      `, [wId]);

      if (req.io) {
        req.io.to(wId).emit('notification', {
          title: 'Salary Generated',
          message: `Your salary for ${paymentMonthString} has been generated.`,
          category: 'PAYROLL'
        });
      }
    }

    res.json({ message: 'Payroll generated successfully', records: generatedRecords });
  } catch (err) {
    console.error('Error generating payroll:', err);
    res.status(500).json({ error: 'Failed to generate payroll' });
  }
};

export const getPayroll = async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const { month, year } = req.query;

    let query = `
      SELECT p.*, u.full_name as worker_name
      FROM monthly_salary_payments p
      JOIN app_users u ON p.worker_id = u.id
      WHERE p.farm_id = $1
        AND LOWER(BTRIM(COALESCE(p.payment_status, ''))) IN ('paid', 'fully paid')
    `;
    const params = [farmId];

    if (month && year) {
      query += ` AND p.payment_month = $2`;
      params.push(`${year}-${month.toString().padStart(2, '0')}`);
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching payroll:', err);
    res.status(500).json({ error: 'Failed to fetch payroll' });
  }
};

export const getMyEarnings = async (req, res) => {
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

    const [userRes, paymentsRes, currentPaymentRes, attendanceRes, summaryRes, ledgerRes] = await Promise.all([
      pool.query(`SELECT full_name FROM app_users WHERE id = $1 LIMIT 1`, [userId]),
      pool.query(`
        SELECT
          st.id,
          COALESCE(p.payment_month, sa.payroll_month, TO_CHAR(st.payment_date, 'YYYY-MM')) AS payment_month,
          st.amount AS final_payment_amount,
          st.amount AS net_salary,
          st.payment_status,
          st.payment_date,
          CASE WHEN LOWER(st.payment_type) = 'advance' THEN 'Salary Advance' ELSE 'Monthly Salary' END AS payment_type,
          u.full_name AS worker_name
        FROM salary_transactions st
        JOIN app_users u ON st.farmer_id = u.id
        LEFT JOIN monthly_salary_payments p ON p.id = st.payroll_id
        LEFT JOIN salary_advances sa ON sa.id = st.advance_request_id
        WHERE st.farmer_id = $1
          AND LOWER(BTRIM(COALESCE(st.payment_status, ''))) = 'paid'
        ORDER BY st.payment_date DESC NULLS LAST, st.created_at DESC
      `, [userId]),
      pool.query(`
        SELECT p.*, u.full_name as worker_name
        FROM monthly_salary_payments p
        JOIN app_users u ON p.worker_id = u.id
        WHERE p.farm_id = $1 AND p.worker_id = $2 AND p.payment_month = $3
        LIMIT 1
      `, [farmId, userId, paymentMonth]),
      pool.query(`
        SELECT
          sa.id,
          sa.date,
          sa.check_in_time,
          sa.check_out_time,
          sa.payable_wage,
          ROUND(COALESCE(NULLIF(sa.total_hours, 0), EXTRACT(EPOCH FROM (sa.check_out_time - sa.check_in_time))/3600, 0)::numeric, 2) as total_hours,
          sa.shift_status as attendance_status,
          (
            SELECT string_agg(t.title, ', ')
            FROM tasks t
            WHERE t.assigned_to_user_id = sa.worker_id
              AND (t.shift_id = sa.shift_id OR (t.shift_id IS NULL AND sa.shift_id IS NULL))
              AND DATE(COALESCE(t.completed_at, t.end_time, t.updated_at)) = DATE(sa.date)
          ) as task_title,
          COALESCE(
            s.shift_name,
            (
              SELECT session::text FROM tasks t
              WHERE t.assigned_to_user_id = sa.worker_id
                AND DATE(COALESCE(t.completed_at, t.end_time, t.updated_at)) = DATE(sa.date)
              LIMIT 1
            )
          ) as session,
          COALESCE(s.base_wage, 0) as base_wage,
          s.overtime_rate,
          ROUND(COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0)::numeric, 2) as derived_hourly_rate,
          COALESCE(s.standard_hours, 0) as standard_hours,
          ROUND(COALESCE(s.base_wage, 0)::numeric, 2) as shift_wage_earned,
          ROUND(
            GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0)
            * COALESCE(s.overtime_rate, 0)
          ::numeric, 2) as overtime_pay
        FROM shift_attendances sa
        LEFT JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.farm_id = $1
          AND sa.worker_id = $2
          AND EXTRACT(MONTH FROM sa.date) = $3
          AND EXTRACT(YEAR FROM sa.date) = $4
        ORDER BY sa.date DESC, sa.created_at DESC
      `, [farmId, userId, month, year]),
      pool.query(`
        SELECT
          COUNT(*)::int as completed_shifts,
          COUNT(DISTINCT DATE(sa.date))::int as active_days,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(s.shift_name, '')) = 'morning' THEN 1 ELSE 0 END), 0)::int as morning_shifts,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(s.shift_name, '')) = 'afternoon' THEN 1 ELSE 0 END), 0)::int as afternoon_shifts,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(s.shift_name, '')) = 'evening' THEN 1 ELSE 0 END), 0)::int as evening_shifts,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(sa.shift_status, '')) != 'absent' THEN COALESCE(NULLIF(sa.total_hours, 0), EXTRACT(EPOCH FROM (sa.check_out_time - sa.check_in_time))/3600, 0) ELSE 0 END), 0)::numeric as total_working_hours,
          COALESCE(SUM(COALESCE(s.base_wage, 0)), 0)::numeric as shift_wage_earned,
          COALESCE(SUM(GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0) * COALESCE(s.overtime_rate, 0)), 0)::numeric as overtime_pay
        FROM shift_attendances sa
        LEFT JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.farm_id = $1
          AND sa.worker_id = $2
          AND EXTRACT(MONTH FROM sa.date) = $3
          AND EXTRACT(YEAR FROM sa.date) = $4
      `, [farmId, userId, month, year]),
      pool.query(`
        SELECT sl.*, t.title as task_title, sl.created_at as date, sl.status, t.shift_id
        FROM salary_ledger sl
        LEFT JOIN tasks t ON sl.task_id = t.id
        WHERE sl.farm_id = $1 AND sl.worker_id = $2
          AND EXTRACT(MONTH FROM sl.created_at) = $3
          AND EXTRACT(YEAR FROM sl.created_at) = $4
        ORDER BY sl.created_at DESC
      `, [farmId, userId, month, year])
    ]);

    const workerName = userRes.rows[0]?.full_name || currentPaymentRes.rows[0]?.worker_name || paymentsRes.rows[0]?.worker_name || '';
    const currentPayment = currentPaymentRes.rows[0] || {};
    const hasPayment = !!currentPayment.id;
    const stats = await getFarmerSalaryStats(farmId, userId, paymentMonth);
    const attendanceMetrics = calculatePayrollMetrics(attendanceRes.rows, {
      month,
      year,
      bonus: Number(currentPayment.bonus ?? currentPayment.bonus_amount ?? 0),
      deductions: Number(currentPayment.deductions ?? 0),
    });

    const paymentShifts = hasPayment
      ? (Number(currentPayment.morning_shifts ?? 0) + Number(currentPayment.afternoon_shifts ?? 0) + Number(currentPayment.evening_shifts ?? 0))
      : 0;

    const ledgerEarningsTotal = ledgerRes.rows.reduce((sum, item) => {
      return sum + Number(item.amount || 0);
    }, 0);

    // Ledger entries are already the earned task wages. Prefer them over the
    // stale/generated payroll total so shift wages are not counted twice.
    const earnedSalary = ledgerEarningsTotal > 0
      ? ledgerEarningsTotal
      : hasPayment
        ? Math.max(0, Number(currentPayment.net_salary ?? currentPayment.gross_salary ?? 0))
        : Math.max(0, Number(stats.net_salary || 0));
    const paidAdvances = Number(stats.advance_paid || 0);
    const paidPartialSalary = Number(stats.partial_paid || 0);
    const remainingSalary = Math.max(0, earnedSalary - paidAdvances - paidPartialSalary);
    const totalDeductions = paidAdvances + paidPartialSalary;

    const summary = {
      payment_month: paymentMonth,
      month_label: new Date(`${paymentMonth}-01`).toLocaleString(undefined, { month: 'long', year: 'numeric' }),
      worker_name: workerName,
      completed_shifts: hasPayment ? paymentShifts : attendanceMetrics.completedShifts,
      present_days: hasPayment ? Number(currentPayment.present_days ?? 0) : attendanceMetrics.presentDays,
      equivalent_present_days: hasPayment ? Number((paymentShifts / 3).toFixed(2)) : attendanceMetrics.equivalentPresentDays,
      attendance_percentage: hasPayment
        ? Number(((paymentShifts / Math.max(new Date(year, month, 0).getDate() * 3, 1)) * 100).toFixed(2))
        : attendanceMetrics.attendancePercentage,
      attendance_status: hasPayment
        ? (paymentShifts === 0 ? 'Absent' : (paymentShifts / 3 >= 1 ? 'Present' : 'Half Day'))
        : attendanceMetrics.attendanceStatus,
      morning_shifts: hasPayment ? Number(currentPayment.morning_shifts ?? 0) : attendanceMetrics.morningShifts,
      afternoon_shifts: hasPayment ? Number(currentPayment.afternoon_shifts ?? 0) : attendanceMetrics.afternoonShifts,
      evening_shifts: hasPayment ? Number(currentPayment.evening_shifts ?? 0) : attendanceMetrics.eveningShifts,
      total_working_hours: hasPayment ? Number(currentPayment.total_working_hours ?? 0) : attendanceMetrics.totalWorkingHours,
      shift_wage_earned: hasPayment ? Number(currentPayment.base_salary ?? currentPayment.basic_salary ?? 0) : attendanceMetrics.shiftWageEarned,
      overtime_pay: hasPayment ? Number(currentPayment.overtime ?? 0) : attendanceMetrics.overtimePay,
      bonus: hasPayment ? Number(currentPayment.bonus ?? 0) : attendanceMetrics.bonus,
      deductions: totalDeductions,
      gross_salary: earnedSalary,
      net_salary: remainingSalary,
      advance_paid: paidAdvances,
      partial_paid: paidPartialSalary,
      remaining_payable: remainingSalary,
      paid_salary: earnedSalary - remainingSalary,
      ledger_earnings: ledgerEarningsTotal,
    };

    res.json({
      summary,
      attendances: attendanceRes.rows,
      payments: paymentsRes.rows,
      ledger: ledgerRes.rows,
    });
  } catch (err) {
    console.error('Error fetching my earnings:', err);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
};

export const getSalaryAdvances = async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const role = String(req.user.role || '').toLowerCase();
    await ensureSalaryAdvanceTable();

    const query = role === 'worker' || role === 'farmer'
      ? `
        SELECT sa.*, u.full_name as worker_name, u.phone as worker_phone
        FROM salary_advances sa
        JOIN app_users u ON sa.worker_id = u.id
        WHERE sa.farm_id = $1 AND sa.worker_id = $2
        ORDER BY sa.requested_at DESC
      `
      : `
        SELECT sa.*, u.full_name as worker_name, u.phone as worker_phone
        FROM salary_advances sa
        JOIN app_users u ON sa.worker_id = u.id
        WHERE sa.farm_id = $1
        ORDER BY sa.requested_at DESC
      `;
    const params = role === 'worker' || role === 'farmer' ? [farmId, userId] : [farmId];
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching salary advances:', err);
    res.status(500).json({ error: 'Failed to fetch salary advances' });
  }
};

export const requestSalaryAdvance = async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const { amount, reason, payrollMonth, paymentMethod, accountDetails } = req.body;
    const requestedAmount = Number(amount);

    if (!requestedAmount || requestedAmount <= 0) {
      return res.status(400).json({ error: 'Advance amount must be greater than zero' });
    }
    if (!String(reason || '').trim()) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    await ensureSalaryAdvanceTable();
    const monthValue = payrollMonth || getMonthYearFromQuery(req).paymentMonth;
    const stats = await getFarmerSalaryStats(farmId, userId, monthValue);
    if (requestedAmount > stats.remaining_payable) {
      return res.status(400).json({ error: 'Requested amount exceeds the remaining payable salary.' });
    }

    const advanceId = randomUUID();

    const insertRes = await pool.query(`
      INSERT INTO salary_advances (
        id, farm_id, worker_id, payroll_month, amount, reason, status, payment_method, account_details, payment_status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Pending', $7, $8, 'PAYMENT_PENDING')
      RETURNING *
    `, [advanceId, farmId, userId, monthValue, requestedAmount, reason.trim(), paymentMethod || 'Cash', accountDetails || null]);

    // The advance is saved successfully even if an optional notification fails.
    res.json(insertRes.rows[0]);

    try {
      const managerRes = await pool.query(
        `SELECT id, email, phone FROM app_users WHERE farm_id = $1 AND LOWER(role::text) IN ('farm_manager', 'super_admin')`,
        [farmId]
      );

      for (const manager of managerRes.rows) {
        await pool.query(`
          INSERT INTO notifications (user_id, title, message, category, delivery_channel)
          VALUES ($1, 'Salary Advance Request', $2, 'PAYROLL', '["Dashboard", "Email", "SMS"]')
        `, [manager.id, `Salary advance request for ${monthValue} from worker ${userId}`]);

        if (req.io) {
          req.io.to(manager.id).emit('notification', {
            title: 'Salary Advance Request',
            message: `Salary advance request for ${monthValue} from worker ${userId}`,
            category: 'PAYROLL',
          });
        }

        if (manager.email) {
          await sendEmail({
            to: manager.email,
            subject: 'Salary Advance Request',
            html: `<p>A salary advance request was submitted for <strong>${monthValue}</strong>.</p><p>Amount: Rs. ${requestedAmount.toFixed(2)}</p><p>Reason: ${reason}</p>`,
            text: `Salary advance request for ${monthValue}. Amount: Rs. ${requestedAmount.toFixed(2)}. Reason: ${reason}`,
          });
        }
      }
    } catch (notificationError) {
      console.error('Salary advance saved, but manager notification failed:', notificationError);
    }
  } catch (err) {
    console.error('Error requesting salary advance:', err);
    res.status(500).json({ error: 'Failed to request salary advance' });
  }
};

export const reviewSalaryAdvance = async (req, res) => {
  try {
    const managerId = req.user.userId;
    const farmId = await getDefaultFarmId(managerId);
    const advanceId = req.params.id;
    const { action, notes } = req.body;

    if (!['Approve', 'Reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (action === 'Reject' && (!notes || !String(notes).trim())) {
      return res.status(400).json({ error: 'Rejection reason is required in notes.' });
    }

    await ensureSalaryAdvanceTable();
    const existing = await pool.query(
      `SELECT * FROM salary_advances WHERE id = $1 AND farm_id = $2 LIMIT 1`,
      [advanceId, farmId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Advance request not found' });
    }

    const advance = existing.rows[0];
    const newStatus = action === 'Approve' ? 'Approved - Payment Pending' : 'Rejected';
    const newPaymentStatus = action === 'Approve' ? 'PAYMENT_PENDING' : 'Rejected';
    const updated = await pool.query(`
      UPDATE salary_advances
      SET status = $1, manager_id = $2, manager_notes = $3, reviewed_at = NOW(), payment_status = $4
      WHERE id = $5
      RETURNING *
    `, [newStatus, managerId, notes ? notes.trim() : null, newPaymentStatus, advanceId]);

    const worker = await pool.query(`SELECT id, email, phone, full_name FROM app_users WHERE id = $1 LIMIT 1`, [advance.worker_id]);
    const workerRecord = worker.rows[0];
    if (workerRecord) {
      const message = action === 'Approve'
        ? `Your salary advance request for ${advance.payroll_month} of Rs. ${Number(advance.amount).toFixed(2)} was approved (payment pending).`
        : `Your salary advance request for ${advance.payroll_month} was rejected.`;

      const emailHtml = action === 'Approve'
        ? `
          <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0284c7; margin-top: 0;">Advance Approved - Payment Pending</h2>
            <p style="color: #333;">Hello ${workerRecord.full_name},</p>
            <p style="color: #333;">Your salary advance request for <strong>${advance.payroll_month}</strong> has been approved by the manager. The payout is now pending and will be processed shortly.</p>
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 5px 0; font-size: 16px;"><strong>Amount Approved:</strong> Rs. ${Number(advance.amount).toFixed(2)}</p>
              <p style="margin: 5px 0; color: #475569;"><strong>Method:</strong> ${advance.payment_method || 'Cash'}</p>
            </div>
            ${notes ? `<p style="color: #475569;"><strong>Manager Note:</strong> ${notes}</p>` : ''}
            <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">Thank you,<br/>Annam Integrated Farm Payroll</p>
          </div>
        `
        : `<p>${message}</p>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}`;

      await notifyPayrollStakeholders(req, {
        farmId,
        workerId: advance.worker_id,
        title: action === 'Approve' ? 'Salary Advance Approved' : 'Salary Advance Rejected',
        message,
        category: 'PAYROLL',
        emailSubject: action === 'Approve' ? 'Salary Advance Approved (Pending Payment)' : 'Salary Advance Rejected',
        emailHtml,
        emailText: notes ? `${message} Notes: ${notes}` : message,
      });
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Error reviewing salary advance:', err);
    res.status(500).json({ error: 'Failed to review salary advance' });
  }
};

export const approvePayrollRecord = async (req, res) => {
  try {
    const managerId = req.user.userId;
    const farmId = await getDefaultFarmId(managerId);
    const payrollId = req.params.id;

    const result = await pool.query(`
      UPDATE monthly_salary_payments
      SET payment_status = 'Approved',
          manager_id = COALESCE(manager_id, $2),
          updated_at = NOW()
      WHERE id = $1 AND farm_id = $3
      RETURNING *
    `, [payrollId, managerId, farmId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    const payroll = result.rows[0];
    await notifyPayrollStakeholders(req, {
      farmId,
      workerId: payroll.worker_id,
      title: 'Salary Approved',
      message: `Your payroll for ${payroll.payment_month} has been approved.`,
      category: 'PAYROLL',
      emailSubject: 'Salary Approved',
      emailHtml: `<p>Your payroll for <strong>${payroll.payment_month}</strong> has been approved.</p>`,
      emailText: `Your payroll for ${payroll.payment_month} has been approved.`,
    });

    res.json(payroll);
  } catch (err) {
    console.error('Error approving payroll record:', err);
    res.status(500).json({ error: 'Failed to approve payroll' });
  }
};

export const paySalaryAdvance = async (req, res) => {
  const client = await pool.connect();
  try {
    const managerId = req.user.userId;
    const farmId = await getDefaultFarmId(managerId);
    const advanceId = req.params.id;
    const { paymentMethod, transactionReference } = req.body;

    if (!['Cash', 'Bank Transfer', 'Online Bank Payout'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // Phase 1: Begin transaction, select advance with FOR UPDATE lock, check eligibility
    await client.query('BEGIN');

    const advanceRes = await client.query(
      `SELECT * FROM salary_advances WHERE id = $1 AND farm_id = $2 FOR UPDATE`,
      [advanceId, farmId]
    );

    if (advanceRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Advance request not found' });
    }

    const advance = advanceRes.rows[0];

    if (advance.status === 'Paid' || advance.payment_status === 'Paid') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'This advance has already been paid.' });
    }

    if (advance.payment_status === 'Processing') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'This payment is currently being processed.' });
    }

    // Determine payroll Details to check remaining balance
    const payrollRes = await client.query(
      `SELECT * FROM monthly_salary_payments WHERE farm_id = $1 AND worker_id = $2 AND payment_month = $3 FOR UPDATE`,
      [farmId, advance.worker_id, advance.payroll_month]
    );

    let payrollId = null;
    let netSalary = 0;
    let advancePaid = 0;
    let partialPaid = 0;

    if (payrollRes.rows.length > 0) {
      const payroll = payrollRes.rows[0];
      payrollId = payroll.id;
      netSalary = Number(payroll.net_salary || 0);
      advancePaid = Number(payroll.advance_paid || 0);
      partialPaid = Number(payroll.partial_paid || 0);

      const remainingPayable = netSalary - advancePaid - partialPaid;
      if (Number(advance.amount) > remainingPayable) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'Advance amount exceeds the remaining payable salary.' });
      }
    }

    if (paymentMethod === 'Cash') {
      await client.query(`
        UPDATE salary_advances
        SET status = 'Paid', payment_status = 'Paid', payment_method = 'Cash', reviewed_at = NOW()
        WHERE id = $1
      `, [advanceId]);

      const transId = randomUUID();
      await client.query(`
        INSERT INTO salary_transactions (
          id, farmer_id, payroll_id, advance_request_id, payment_type, payment_method, amount, payment_status, payment_date, paid_by
        ) VALUES ($1, $2, $3, $4, 'Advance', 'Cash', $5, 'Paid', NOW(), $6)
      `, [transId, advance.worker_id, payrollId, advanceId, advance.amount, managerId]);

      if (payrollId) {
        const newAdvancePaid = advancePaid + Number(advance.amount);
        const newFinalAmount = Math.max(0, netSalary - newAdvancePaid - partialPaid);
        const newStatus = newFinalAmount <= 0 ? 'FULLY PAID' : 'PARTIALLY PAID';

        await client.query(`
          UPDATE monthly_salary_payments
          SET advance_paid = $1, final_payment_amount = $2, payment_status = $3, updated_at = NOW(), manager_id = $4
          WHERE id = $5
        `, [newAdvancePaid, newFinalAmount, newStatus, managerId, payrollId]);

        await client.query(`
          UPDATE salary_advances SET deducted_from_payment_id = $1 WHERE id = $2
        `, [payrollId, advanceId]);
      }

      await client.query('COMMIT');
      client.release();

      await notifyPayrollStakeholders(req, {
        farmId,
        workerId: advance.worker_id,
        title: 'Salary Advance Paid',
        message: `Your salary advance of Rs. ${Number(advance.amount).toFixed(2)} has been paid in Cash.`,
        category: 'PAYROLL',
        emailSubject: 'Salary Advance Paid (Cash)',
        emailHtml: `<p>Your salary advance request of <strong>Rs. ${Number(advance.amount).toFixed(2)}</strong> has been paid in Cash.</p>`
      });

      return res.json({ success: true, message: 'Cash payment processed successfully.' });

    } else if (paymentMethod === 'Bank Transfer') {
      if (!transactionReference || !String(transactionReference).trim()) {
        await client.query(`
          UPDATE salary_advances
          SET payment_status = 'Payment Pending Confirmation', payment_method = 'Bank Transfer'
          WHERE id = $1
        `, [advanceId]);

        const transId = randomUUID();
        await client.query(`
          INSERT INTO salary_transactions (
            id, farmer_id, payroll_id, advance_request_id, payment_type, payment_method, amount, payment_status, payment_date, paid_by
          ) VALUES ($1, $2, $3, $4, 'Advance', 'Bank Transfer', $5, 'Payment Pending Confirmation', NOW(), $6)
        `, [transId, advance.worker_id, payrollId, advanceId, advance.amount, managerId]);

        await client.query('COMMIT');
        client.release();

        return res.json({
          success: true,
          status: 'Payment Pending Confirmation',
          message: 'Payment initiated. Awaiting transaction reference confirmation.'
        });
      } else {
        await client.query(`
          UPDATE salary_advances
          SET status = 'Paid', payment_status = 'Paid', payment_method = 'Bank Transfer', bank_reference = $1, payment_date = NOW()::text
          WHERE id = $2
        `, [transactionReference.trim(), advanceId]);

        const transId = randomUUID();
        await client.query(`
          INSERT INTO salary_transactions (
            id, farmer_id, payroll_id, advance_request_id, payment_type, payment_method, amount, transaction_id, payment_status, payment_date, paid_by
          ) VALUES ($1, $2, $3, $4, 'Advance', 'Bank Transfer', $5, $6, 'Paid', NOW(), $7)
        `, [transId, advance.worker_id, payrollId, advanceId, advance.amount, transactionReference.trim(), managerId]);

        if (payrollId) {
          const newAdvancePaid = advancePaid + Number(advance.amount);
          const newFinalAmount = Math.max(0, netSalary - newAdvancePaid - partialPaid);
          const newStatus = newFinalAmount <= 0 ? 'FULLY PAID' : 'PARTIALLY PAID';

          await client.query(`
            UPDATE monthly_salary_payments
            SET advance_paid = $1, final_payment_amount = $2, payment_status = $3, updated_at = NOW(), manager_id = $4
            WHERE id = $5
          `, [newAdvancePaid, newFinalAmount, newStatus, managerId, payrollId]);

          await client.query(`
            UPDATE salary_advances SET deducted_from_payment_id = $1 WHERE id = $2
          `, [payrollId, advanceId]);
        }

        await client.query('COMMIT');
        client.release();

        await notifyPayrollStakeholders(req, {
          farmId,
          workerId: advance.worker_id,
          title: 'Salary Advance Paid',
          message: `Your salary advance of Rs. ${Number(advance.amount).toFixed(2)} has been paid via Bank Transfer. Ref: ${transactionReference}`,
          category: 'PAYROLL',
          emailSubject: 'Salary Advance Paid (Bank Transfer)',
          emailHtml: `<p>Your salary advance request of <strong>Rs. ${Number(advance.amount).toFixed(2)}</strong> has been paid via Bank Transfer.</p><p><strong>Transaction Reference:</strong> ${transactionReference}</p>`
        });

        return res.json({ success: true, message: 'Bank Transfer confirmed successfully.' });
      }

    } else if (paymentMethod === 'Online Bank Payout') {
      await client.query(`
        UPDATE salary_advances
        SET payment_status = 'Processing', payment_method = 'Online Bank Payout'
        WHERE id = $1
      `, [advanceId]);

      await client.query('COMMIT');
      client.release();

      const provider = getPayoutProvider();
      const accountDetails = advance.account_details || '**** **** 6036';
      const payoutRes = await provider.initiatePayout({
        amount: Number(advance.amount),
        sourceAccount: process.env.FARM_DEFAULT_BANK_ACCOUNT || 'farm default account',
        recipientAccount: accountDetails,
        reference: `ADVANCE-${advanceId}`
      });

      const phase2Client = await pool.connect();
      try {
        await phase2Client.query('BEGIN');

        if (payoutRes.success) {
          await phase2Client.query(`
            UPDATE salary_advances
            SET status = 'Paid', payment_status = 'Paid', transaction_id = $1, provider = $2, payment_date = NOW()::text
            WHERE id = $3
          `, [payoutRes.transactionId, payoutRes.mode || 'REAL_PROVIDER', advanceId]);

          const transId = randomUUID();
          await phase2Client.query(`
            INSERT INTO salary_transactions (
              id, farmer_id, payroll_id, advance_request_id, payment_type, payment_method, amount, provider, transaction_id, payment_status, payment_date, paid_by
            ) VALUES ($1, $2, $3, $4, 'Advance', 'Online Bank Payout', $5, $6, $7, 'Paid', NOW(), $8)
          `, [transId, advance.worker_id, payrollId, advanceId, advance.amount, payoutRes.mode || 'REAL_PROVIDER', payoutRes.transactionId, managerId]);

          if (payrollId) {
            const payrollRowLock = await phase2Client.query(
              `SELECT * FROM monthly_salary_payments WHERE id = $1 FOR UPDATE`,
              [payrollId]
            );
            if (payrollRowLock.rows.length > 0) {
              const p = payrollRowLock.rows[0];
              const curAdvancePaid = Number(p.advance_paid || 0);
              const curPartialPaid = Number(p.partial_paid || 0);
              const curNetSalary = Number(p.net_salary || 0);

              const newAdvancePaid = curAdvancePaid + Number(advance.amount);
              const newFinalAmount = Math.max(0, curNetSalary - newAdvancePaid - curPartialPaid);
              const newStatus = newFinalAmount <= 0 ? 'FULLY PAID' : 'PARTIALLY PAID';

              await phase2Client.query(`
                UPDATE monthly_salary_payments
                SET advance_paid = $1, final_payment_amount = $2, payment_status = $3, updated_at = NOW(), manager_id = $4
                WHERE id = $5
              `, [newAdvancePaid, newFinalAmount, newStatus, managerId, payrollId]);

              await phase2Client.query(`
                UPDATE salary_advances SET deducted_from_payment_id = $1 WHERE id = $2
              `, [payrollId, advanceId]);
            }
          }

          await phase2Client.query('COMMIT');
          phase2Client.release();

          await notifyPayrollStakeholders(req, {
            farmId,
            workerId: advance.worker_id,
            title: 'Salary Advance Paid',
            message: `Your salary advance of Rs. ${Number(advance.amount).toFixed(2)} was successfully paid online.`,
            category: 'PAYROLL',
            emailSubject: 'Salary Advance Paid (Online Payout)',
            emailHtml: `<p>Your salary advance request of <strong>Rs. ${Number(advance.amount).toFixed(2)}</strong> has been successfully processed online.</p><p><strong>Transaction ID:</strong> ${payoutRes.transactionId}</p>`
          });

          return res.json({
            success: true,
            status: 'Paid',
            transactionId: payoutRes.transactionId,
            message: 'Online payout completed successfully.'
          });

        } else {
          await phase2Client.query(`
            UPDATE salary_advances
            SET status = 'Approved - Payment Pending', payment_status = 'Payment Failed'
            WHERE id = $1
          `, [advanceId]);

          const transId = randomUUID();
          await phase2Client.query(`
            INSERT INTO salary_transactions (
              id, farmer_id, payroll_id, advance_request_id, payment_type, payment_method, amount, provider, payment_status, payment_date, paid_by
            ) VALUES ($1, $2, $3, $4, 'Advance', 'Online Bank Payout', $5, $6, 'Failed', NOW(), $7)
          `, [transId, advance.worker_id, payrollId, advanceId, advance.amount, payoutRes.mode || 'REAL_PROVIDER', managerId]);

          await phase2Client.query('COMMIT');
          phase2Client.release();

          return res.status(400).json({
            error: `Online bank payout failed: ${payoutRes.error || 'Provider rejected transfer'}`
          });
        }

      } catch (innerErr) {
        await phase2Client.query('ROLLBACK');
        phase2Client.release();
        throw innerErr;
      }
    }

  } catch (err) {
    console.error('Error in paySalaryAdvance:', err);
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    client.release();
    res.status(500).json({ error: 'Failed to process salary advance payment' });
  }
};

export const processSalaryPayment = async (req, res) => {
  const client = await pool.connect();
  try {
    const managerId = req.user.userId;
    const farmId = await getDefaultFarmId(managerId);
    let payrollId = req.params.id;
    const { paymentMethod, transactionReference, notes, bonus } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    // Handle cases where the request specifies workerId instead of payrollId (e.g. from MonthlyPaymentFormModal)
    // We check if payrollId is not a valid UUID, or if we explicitly passed workerId
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payrollId);
    if (!isUuid) {
      const workerId = req.params.workerId || req.params.id;
      const paymentMonth = req.body.payment_month;
      const lookup = await pool.query(
        `SELECT id FROM monthly_salary_payments WHERE farm_id = $1 AND worker_id = $2 AND payment_month = $3 LIMIT 1`,
        [farmId, workerId, paymentMonth]
      );
      if (lookup.rows.length > 0) {
        payrollId = lookup.rows[0].id;
      } else {
        client.release();
        return res.status(404).json({ error: 'Payroll record not found for this worker and month' });
      }
    }

    // Phase 1: Begin transaction, lock payroll record
    await client.query('BEGIN');

    const result = await client.query(`
      SELECT p.*, u.email, u.phone, u.full_name as worker_name
      FROM monthly_salary_payments p
      JOIN app_users u ON p.worker_id = u.id
      WHERE p.id = $1 AND p.farm_id = $2
      FOR UPDATE
    `, [payrollId, farmId]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    const payroll = result.rows[0];

    if (payroll.payment_status === 'Paid' || payroll.payment_status === 'FULLY PAID') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'This salary has already been fully paid.' });
    }

    if (payroll.payment_status === 'Processing') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'This payment is currently being processed.' });
    }

    const bonusAmt = Number(bonus || 0);
    const newBonus = Number(payroll.bonus || 0) + bonusAmt;
    const newGross = Number(payroll.gross_salary || 0) + bonusAmt;
    const newNet = Number(payroll.net_salary || 0) + bonusAmt;

    const advancePaid = Number(payroll.advance_paid || 0);
    const partialPaid = Number(payroll.partial_paid || 0);
    const remainingPayable = Math.max(0, newNet - advancePaid - partialPaid);

    if (remainingPayable <= 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Remaining payable balance is Rs. 0.00' });
    }

    if (paymentMethod === 'Cash') {
      await client.query(`
        UPDATE monthly_salary_payments
        SET payment_status = 'FULLY PAID',
            payment_method = 'Cash',
            transaction_reference = $1,
            payment_date = NOW(),
            final_payment_amount = $2,
            bonus = $3,
            gross_salary = $4,
            net_salary = $5,
            manager_id = COALESCE(manager_id, $6),
            updated_at = NOW()
        WHERE id = $7
      `, [transactionReference || 'Cash Payment', remainingPayable, newBonus, newGross, newNet, managerId, payrollId]);

      const transId = randomUUID();
      await client.query(`
        INSERT INTO salary_transactions (
          id, farmer_id, payroll_id, payment_type, payment_method, amount, payment_status, payment_date, paid_by
        ) VALUES ($1, $2, $3, 'Final Salary', 'Cash', $4, 'Paid', NOW(), $5)
      `, [transId, payroll.worker_id, payrollId, remainingPayable, managerId]);

      await client.query('COMMIT');
      client.release();

      await notifyPayrollStakeholders(req, {
        farmId,
        workerId: payroll.worker_id,
        title: 'Salary Paid',
        message: `Your final salary for ${payroll.payment_month} has been paid in Cash.`,
        category: 'PAYROLL',
        emailSubject: 'Salary Paid (Cash)',
        emailHtml: `<p>Your final salary for <strong>${payroll.payment_month}</strong> of <strong>Rs. ${remainingPayable.toFixed(2)}</strong> has been paid in Cash.</p>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}`
      });

      return res.json({ success: true, message: 'Cash payment processed successfully.' });

    } else if (paymentMethod === 'Bank Transfer') {
      if (!transactionReference || !String(transactionReference).trim()) {
        await client.query(`
          UPDATE monthly_salary_payments
          SET payment_status = 'Payment Pending Confirmation',
              payment_method = 'Bank Transfer',
              bonus = $1,
              gross_salary = $2,
              net_salary = $3,
              manager_id = COALESCE(manager_id, $4),
              updated_at = NOW()
          WHERE id = $5
        `, [newBonus, newGross, newNet, managerId, payrollId]);

        const transId = randomUUID();
        await client.query(`
          INSERT INTO salary_transactions (
            id, farmer_id, payroll_id, payment_type, payment_method, amount, payment_status, payment_date, paid_by
          ) VALUES ($1, $2, $3, 'Final Salary', 'Bank Transfer', $4, 'Payment Pending Confirmation', NOW(), $5)
        `, [transId, payroll.worker_id, payrollId, remainingPayable, managerId]);

        await client.query('COMMIT');
        client.release();

        return res.json({
          success: true,
          status: 'Payment Pending Confirmation',
          message: 'Payment initiated. Awaiting transaction reference confirmation.'
        });
      } else {
        await client.query(`
          UPDATE monthly_salary_payments
          SET payment_status = 'FULLY PAID',
              payment_method = 'Bank Transfer',
              transaction_reference = $1,
              payment_date = NOW(),
              final_payment_amount = $2,
              bonus = $3,
              gross_salary = $4,
              net_salary = $5,
              manager_id = COALESCE(manager_id, $6),
              updated_at = NOW()
          WHERE id = $7
        `, [transactionReference.trim(), remainingPayable, newBonus, newGross, newNet, managerId, payrollId]);

        const transId = randomUUID();
        await client.query(`
          INSERT INTO salary_transactions (
            id, farmer_id, payroll_id, payment_type, payment_method, amount, transaction_id, payment_status, payment_date, paid_by
          ) VALUES ($1, $2, $3, 'Final Salary', 'Bank Transfer', $4, $5, 'Paid', NOW(), $6)
        `, [transId, payroll.worker_id, payrollId, remainingPayable, transactionReference.trim(), managerId]);

        await client.query('COMMIT');
        client.release();

        await notifyPayrollStakeholders(req, {
          farmId,
          workerId: payroll.worker_id,
          title: 'Salary Paid',
          message: `Your final salary for ${payroll.payment_month} has been paid via Bank Transfer. Ref: ${transactionReference}`,
          category: 'PAYROLL',
          emailSubject: 'Salary Paid (Bank Transfer)',
          emailHtml: `<p>Your final salary for <strong>${payroll.payment_month}</strong> of <strong>Rs. ${remainingPayable.toFixed(2)}</strong> has been paid via Bank Transfer.</p><p><strong>Transaction Reference:</strong> ${transactionReference}</p>`
        });

        return res.json({ success: true, message: 'Bank Transfer confirmed successfully.' });
      }

    } else if (paymentMethod === 'Online Bank Payout') {
      await client.query(`
        UPDATE monthly_salary_payments
        SET payment_status = 'Processing',
            payment_method = 'Online Bank Payout',
            bonus = $1,
            gross_salary = $2,
            net_salary = $3,
            manager_id = COALESCE(manager_id, $4),
            updated_at = NOW()
        WHERE id = $5
      `, [newBonus, newGross, newNet, managerId, payrollId]);

      await client.query('COMMIT');
      client.release();

      const provider = getPayoutProvider();
      const accountDetails = payroll.account_number_masked || '**** **** 6036';
      const payoutRes = await provider.initiatePayout({
        amount: remainingPayable,
        recipientAccount: accountDetails,
        reference: `SALARY-${payrollId}`
      });

      const phase2Client = await pool.connect();
      try {
        await phase2Client.query('BEGIN');

        if (payoutRes.success) {
          await phase2Client.query(`
            UPDATE monthly_salary_payments
            SET payment_status = 'FULLY PAID',
                transaction_reference = $1,
                payment_date = NOW(),
                final_payment_amount = $2,
                updated_at = NOW()
            WHERE id = $3
          `, [payoutRes.transactionId, remainingPayable, payrollId]);

          const transId = randomUUID();
          await phase2Client.query(`
            INSERT INTO salary_transactions (
              id, farmer_id, payroll_id, payment_type, payment_method, amount, provider, transaction_id, payment_status, payment_date, paid_by
            ) VALUES ($1, $2, $3, 'Final Salary', 'Online Bank Payout', $4, $5, $6, 'Paid', NOW(), $7)
          `, [transId, payroll.worker_id, payrollId, remainingPayable, payoutRes.mode || 'REAL_PROVIDER', payoutRes.transactionId, managerId]);

          await phase2Client.query('COMMIT');
          phase2Client.release();

          await notifyPayrollStakeholders(req, {
            farmId,
            workerId: payroll.worker_id,
            title: 'Salary Paid',
            message: `Your final salary for ${payroll.payment_month} of Rs. ${remainingPayable.toFixed(2)} was successfully paid online.`,
            category: 'PAYROLL',
            emailSubject: 'Salary Paid (Online Payout)',
            emailHtml: `<p>Your final salary for <strong>${payroll.payment_month}</strong> of <strong>Rs. ${remainingPayable.toFixed(2)}</strong> has been successfully processed online.</p><p><strong>Transaction ID:</strong> ${payoutRes.transactionId}</p>`
          });

          return res.json({
            success: true,
            status: 'Paid',
            transactionId: payoutRes.transactionId,
            message: 'Online payout completed successfully.'
          });

        } else {
          await phase2Client.query(`
            UPDATE monthly_salary_payments
            SET payment_status = 'Approved',
                updated_at = NOW()
            WHERE id = $1
          `, [payrollId]);

          const transId = randomUUID();
          await phase2Client.query(`
            INSERT INTO salary_transactions (
              id, farmer_id, payroll_id, payment_type, payment_method, amount, provider, payment_status, payment_date, paid_by
            ) VALUES ($1, $2, $3, 'Final Salary', 'Online Bank Payout', $4, $5, 'Failed', NOW(), $6)
          `, [transId, payroll.worker_id, payrollId, remainingPayable, payoutRes.mode || 'REAL_PROVIDER', managerId]);

          await phase2Client.query('COMMIT');
          phase2Client.release();

          return res.status(400).json({
            error: `Online bank payout failed: ${payoutRes.error || 'Provider rejected transfer'}`
          });
        }

      } catch (innerErr) {
        await phase2Client.query('ROLLBACK');
        phase2Client.release();
        throw innerErr;
      }
    }

  } catch (err) {
    console.error('Error processing salary payment:', err);
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    client.release();
    res.status(500).json({ error: 'Failed to process salary payment' });
  }
};

export const getSalaryReport = async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const result = await pool.query(`
      SELECT
        p.worker_id,
        u.full_name as worker_name,
        p.payment_month,
        p.total_completed_tasks,
        p.total_approved_sessions,
        COALESCE(p.net_salary, p.basic_salary, 0) as basic_salary,
        BTRIM(COALESCE(p.payment_status, 'Pending')) as payment_status,
        (LOWER(BTRIM(COALESCE(p.payment_status, ''))) IN ('paid', 'fully paid')) as is_paid
      FROM monthly_salary_payments p
      JOIN app_users u ON p.worker_id = u.id
      WHERE p.farm_id = $1
        AND LOWER(BTRIM(COALESCE(p.payment_status, ''))) IN ('paid', 'fully paid')
      UNION ALL
      SELECT
        sa.worker_id,
        u.full_name as worker_name,
        sa.payroll_month as payment_month,
        0 as total_completed_tasks,
        0 as total_approved_sessions,
        sa.amount as basic_salary,
        'Paid' as payment_status,
        true as is_paid
      FROM salary_advances sa
      JOIN app_users u ON sa.worker_id = u.id
      WHERE sa.farm_id = $1
        AND (LOWER(BTRIM(COALESCE(sa.status, ''))) = 'paid'
          OR LOWER(BTRIM(COALESCE(sa.payment_status, ''))) = 'paid')
      ORDER BY payment_month DESC, worker_name ASC
    `, [farmId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching salary report:', err);
    res.status(500).json({ error: 'Failed to fetch salary report' });
  }
};
