import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';
import { syncAttendanceFromCompletedTasks } from './taskController.js';
import { calculatePayrollMetrics } from '../utils/payrollMath.js';
import { sendEmail } from '../services/emailService.js';
import { randomUUID } from 'crypto';

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
      requested_at timestamptz NOT NULL DEFAULT NOW(),
      reviewed_at timestamptz NULL,
      deducted_from_payment_id uuid NULL
    )
  `);
}

async function getApprovedAdvanceTotal({ farmId, workerId, payrollMonth }) {
  await ensureSalaryAdvanceTable();
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS total
     FROM salary_advances
     WHERE farm_id = $1 AND worker_id = $2 AND payroll_month = $3 AND status = 'Approved'`,
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
        ROUND(COALESCE(s.base_wage, 0)::numeric, 2) AS shift_wage_earned,
        ROUND(COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0)::numeric, 2) AS derived_hourly_rate,
        ROUND(
          GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0)
          * COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0)
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
      const approvedAdvances = await getApprovedAdvanceTotal({ farmId, workerId: wId, payrollMonth: paymentMonthString });
      const metrics = calculatePayrollMetrics(ws, { month, year, deductions: approvedAdvances });
      const gross = metrics.grossSalary;
      const net = metrics.netSalary;

      const resInsert = await pool.query(`
        INSERT INTO monthly_salary_payments (
          farm_id, worker_id, manager_id, payment_month,
          present_days, half_days, leaves, morning_shifts, afternoon_shifts, evening_shifts,
          total_working_hours, overtime, base_salary, hourly_wage_total,
          gross_salary, net_salary, payment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'Pending')
        RETURNING *
      `, [
        farmId, wId, userId, paymentMonthString,
        metrics.completedShifts, metrics.halfDays, 0, metrics.morningShifts, metrics.afternoonShifts, metrics.eveningShifts,
        metrics.totalWorkingHours, metrics.overtimePay, metrics.shiftWageEarned, 0,
        gross, net
      ]);

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

    const [userRes, paymentsRes, currentPaymentRes, attendanceRes, summaryRes] = await Promise.all([
      pool.query(`SELECT full_name FROM app_users WHERE id = $1 LIMIT 1`, [userId]),
      pool.query(`
        SELECT p.*, u.full_name as worker_name
        FROM monthly_salary_payments p
        JOIN app_users u ON p.worker_id = u.id
        WHERE p.farm_id = $1 AND p.worker_id = $2
        ORDER BY p.payment_month DESC, p.created_at DESC
      `, [farmId, userId]),
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
          sa.total_hours,
          sa.shift_status as attendance_status,
          t.title as task_title,
          COALESCE(s.shift_name, t.session::text) as session,
          COALESCE(s.base_wage, 0) as base_wage,
          ROUND(COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0)::numeric, 2) as derived_hourly_rate,
          COALESCE(s.standard_hours, 0) as standard_hours,
          ROUND(COALESCE(s.base_wage, 0)::numeric, 2) as shift_wage_earned,
          ROUND(
            GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0)
            * COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0)
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
          COUNT(*)::int as completed_shifts,
          COUNT(DISTINCT DATE(sa.date))::int as active_days,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(s.shift_name, '')) = 'morning' THEN 1 ELSE 0 END), 0)::int as morning_shifts,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(s.shift_name, '')) = 'afternoon' THEN 1 ELSE 0 END), 0)::int as afternoon_shifts,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(s.shift_name, '')) = 'evening' THEN 1 ELSE 0 END), 0)::int as evening_shifts,
          COALESCE(SUM(COALESCE(sa.total_hours, 0)), 0)::numeric as total_working_hours,
          COALESCE(SUM(COALESCE(s.base_wage, 0)), 0)::numeric as shift_wage_earned,
          COALESCE(SUM(GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0) * COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0)), 0)::numeric as overtime_pay
        FROM shift_attendances sa
        LEFT JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.farm_id = $1
          AND sa.worker_id = $2
          AND EXTRACT(MONTH FROM sa.date) = $3
          AND EXTRACT(YEAR FROM sa.date) = $4
      `, [farmId, userId, month, year]),
    ]);

    const workerName = userRes.rows[0]?.full_name || currentPaymentRes.rows[0]?.worker_name || paymentsRes.rows[0]?.worker_name || '';
    const currentPayment = currentPaymentRes.rows[0] || {};
    const payrollSummary = summaryRes.rows[0] || {};
    const approvedAdvances = await getApprovedAdvanceTotal({ farmId, workerId: userId, payrollMonth: paymentMonth });
    const attendanceMetrics = calculatePayrollMetrics(attendanceRes.rows, {
      month,
      year,
      bonus: Number(currentPayment.bonus ?? currentPayment.bonus_amount ?? 0),
      deductions: Number(currentPayment.deductions ?? 0) + approvedAdvances,
    });
    const summary = {
      payment_month: paymentMonth,
      month_label: new Date(`${paymentMonth}-01`).toLocaleString(undefined, { month: 'long', year: 'numeric' }),
      worker_name: workerName,
      completed_shifts: attendanceMetrics.completedShifts,
      present_days: attendanceMetrics.presentDays,
      equivalent_present_days: attendanceMetrics.equivalentPresentDays,
      attendance_percentage: attendanceMetrics.attendancePercentage,
      attendance_status: attendanceMetrics.attendanceStatus,
      morning_shifts: attendanceMetrics.morningShifts,
      afternoon_shifts: attendanceMetrics.afternoonShifts,
      evening_shifts: attendanceMetrics.eveningShifts,
      total_working_hours: attendanceMetrics.totalWorkingHours,
      shift_wage_earned: attendanceMetrics.shiftWageEarned,
      overtime_pay: attendanceMetrics.overtimePay,
      bonus: attendanceMetrics.bonus,
      deductions: attendanceMetrics.deductions,
      gross_salary: attendanceMetrics.grossSalary,
      net_salary: attendanceMetrics.netSalary,
      paid_salary: Number(currentPayment.final_payment_amount ?? currentPayment.net_salary ?? attendanceMetrics.netSalary),
    };

    res.json({
      summary,
      attendances: attendanceRes.rows,
      payments: paymentsRes.rows,
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
    const advanceId = randomUUID();

    const insertRes = await pool.query(`
      INSERT INTO salary_advances (
        id, farm_id, worker_id, payroll_month, amount, reason, status, payment_method, account_details
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Pending', $7, $8)
      RETURNING *
    `, [advanceId, farmId, userId, monthValue, requestedAmount, reason.trim(), paymentMethod || 'Cash', accountDetails || null]);

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

    res.json(insertRes.rows[0]);
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

    await ensureSalaryAdvanceTable();
    const existing = await pool.query(
      `SELECT * FROM salary_advances WHERE id = $1 AND farm_id = $2 LIMIT 1`,
      [advanceId, farmId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Advance request not found' });
    }

    const advance = existing.rows[0];
    const newStatus = action === 'Approve' ? 'Approved' : 'Rejected';
    const updated = await pool.query(`
      UPDATE salary_advances
      SET status = $1, manager_id = $2, manager_notes = $3, reviewed_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [newStatus, managerId, notes || null, advanceId]);

    if (newStatus === 'Approved') {
      // Try to deduct from existing pending payroll for that month so the Queue updates immediately
      await pool.query(`
        UPDATE monthly_salary_payments
        SET net_salary = net_salary - $1,
            final_payment_amount = final_payment_amount - $1,
            updated_at = NOW()
        WHERE worker_id = $2 AND payment_month = $3 AND payment_status = 'Pending'
      `, [advance.amount, advance.worker_id, advance.payroll_month]);
    }

    const worker = await pool.query(`SELECT id, email, phone, full_name FROM app_users WHERE id = $1 LIMIT 1`, [advance.worker_id]);
    const workerRecord = worker.rows[0];
    if (workerRecord) {
      const message = action === 'Approve'
        ? `Your salary advance request for ${advance.payroll_month} was approved.`
        : `Your salary advance request for ${advance.payroll_month} was rejected.`;

      let balanceInfo = '';
      if (action === 'Approve') {
        const payrollCheck = await pool.query(`
          SELECT net_salary FROM monthly_salary_payments
          WHERE worker_id = $1 AND payment_month = $2 AND payment_status = 'Pending'
        `, [advance.worker_id, advance.payroll_month]);
        
        if (payrollCheck.rows.length > 0) {
          balanceInfo = `<p style="margin: 5px 0;"><strong>Remaining Balance for ${advance.payroll_month}:</strong> Rs. ${Number(payrollCheck.rows[0].net_salary).toFixed(2)}</p>`;
        }
      }

      const emailHtml = action === 'Approve'
        ? `
          <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #059669; margin-top: 0;">Payment Approved</h2>
            <p style="color: #333;">Hello ${workerRecord.full_name},</p>
            <p style="color: #333;">Your salary advance request for <strong>${advance.payroll_month}</strong> has been successfully processed.</p>
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 5px 0; font-size: 16px;"><strong>Amount Paid:</strong> Rs. ${Number(advance.amount).toFixed(2)}</p>
              <p style="margin: 5px 0; color: #475569;"><strong>Method:</strong> ${advance.payment_method || 'Cash'}</p>
              ${advance.account_details ? `<p style="margin: 5px 0; color: #475569;"><strong>Account:</strong> ${advance.account_details}</p>` : ''}
              ${balanceInfo}
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
        emailSubject: action === 'Approve' ? 'Salary Advance Approved & Paid' : 'Salary Advance Rejected',
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

export const processSalaryPayment = async (req, res) => {
  try {
    const managerId = req.user.userId;
    const farmId = await getDefaultFarmId(managerId);
    const payrollId = req.params.id;
    const { paymentMethod, transactionReference, notes } = req.body;

    const result = await pool.query(`
      SELECT p.*, u.email, u.phone, u.full_name as worker_name
      FROM monthly_salary_payments p
      JOIN app_users u ON p.worker_id = u.id
      WHERE p.id = $1 AND p.farm_id = $2
      LIMIT 1
    `, [payrollId, farmId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    const payroll = result.rows[0];
    const finalAmount = Number(payroll.net_salary || payroll.gross_salary || 0);

    const updated = await pool.query(`
      UPDATE monthly_salary_payments
      SET payment_status = 'Paid',
          payment_method = $2,
          transaction_reference = $3,
          payment_date = NOW(),
          final_payment_amount = $4,
          manager_id = COALESCE(manager_id, $5),
          updated_at = NOW()
      WHERE id = $1 AND farm_id = $6
      RETURNING *
    `, [payrollId, paymentMethod || 'Cash', transactionReference || null, finalAmount, managerId, farmId]);

    await notifyPayrollStakeholders(req, {
      farmId,
      workerId: payroll.worker_id,
      title: 'Salary Paid',
      message: `Your salary for ${payroll.payment_month} has been paid.`,
      category: 'PAYROLL',
      emailSubject: 'Salary Paid',
      emailHtml: `<p>Your salary for <strong>${payroll.payment_month}</strong> has been paid.</p><p>Amount: Rs. ${finalAmount.toFixed(2)}</p>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}`,
      emailText: `Your salary for ${payroll.payment_month} has been paid. Amount: Rs. ${finalAmount.toFixed(2)}.`,
    });

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Error processing salary payment:', err);
    res.status(500).json({ error: 'Failed to process salary payment' });
  }
};
