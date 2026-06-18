import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';

export async function getPendingAttendances(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const result = await pool.query(`
      SELECT ta.*, u.full_name as worker_name, t.title as task_title
      FROM task_attendances ta
      JOIN app_users u ON ta.worker_id = u.id
      JOIN tasks t ON ta.task_id = t.id
      WHERE ta.farm_id = $1 AND ta.status = 'pending' AND ta.attendance_status = 'Completed'
      ORDER BY ta.date DESC
    `, [farmId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending attendances:', err);
    res.status(500).json({ error: 'Failed to fetch pending attendances' });
  }
}

export async function approveAttendance(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const attendanceId = req.params.id;

    const result = await pool.query(`
      UPDATE task_attendances
      SET status = 'approved', updated_at = NOW()
      WHERE id = $1 AND farm_id = $2
      RETURNING *
    `, [attendanceId, farmId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Attendance record not found or unauthorized' });
    }

    res.json({ message: 'Attendance approved', attendance: result.rows[0] });
  } catch (err) {
    console.error('Error approving attendance:', err);
    res.status(500).json({ error: 'Failed to approve attendance' });
  }
}

export async function getMonthlySalarySummary(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const result = await pool.query(`
      SELECT 
        u.id as worker_id,
        u.full_name as worker_name,
        TO_CHAR(ta.date, 'FMMonth YYYY') as payment_month,
        COUNT(ta.id) as total_completed_tasks,
        COUNT(ta.id) as total_approved_sessions,
        SUM(ta.payment_amount) as basic_salary
      FROM app_users u
      JOIN task_attendances ta ON u.id = ta.worker_id
      WHERE ta.farm_id = $1 AND ta.status = 'approved' AND ta.attendance_status = 'Completed'
      GROUP BY u.id, u.full_name, TO_CHAR(ta.date, 'FMMonth YYYY')
      ORDER BY payment_month DESC, u.full_name
    `, [farmId]);

    // Trim strings for month to avoid whitespace issues
    const rows = result.rows.map(r => ({
      ...r,
      payment_month: r.payment_month.trim()
    }));

    res.json(rows);
  } catch (err) {
    console.error('Error generating salary report:', err);
    res.status(500).json({ error: 'Failed to generate salary report' });
  }
}

export async function submitMonthlyPayment(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const workerId = req.params.worker_id;

    const {
      payment_month,
      bank_account_name,
      bank_name,
      branch_name,
      account_number,
      payment_method,
      transaction_reference,
      bonus = 0
    } = req.body;

    // Mask account number
    const account_number_masked = account_number ? '***' + account_number.slice(-4) : null;

    // Calculate totals
    const taskRes = await pool.query(`
      SELECT 
        COUNT(id) as total_completed_tasks,
        SUM(payment_amount) as basic_salary
      FROM task_attendances
      WHERE worker_id = $1 AND farm_id = $2 AND status = 'approved' AND TO_CHAR(date, 'FMMonth YYYY') = $3
    `, [workerId, farmId, payment_month]);

    const total_completed_tasks = parseInt(taskRes.rows[0].total_completed_tasks) || 0;
    const basic_salary = parseFloat(taskRes.rows[0].basic_salary) || 0;
    const final_payment_amount = basic_salary + parseFloat(bonus);

    const payRes = await pool.query(`
      INSERT INTO monthly_salary_payments (
        farm_id, worker_id, manager_id, payment_month,
        total_completed_tasks, total_approved_sessions,
        basic_salary, bonus, final_payment_amount,
        bank_account_name, bank_name, branch_name, account_number_masked,
        payment_method, transaction_reference
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      farmId, workerId, userId, payment_month,
      total_completed_tasks, total_completed_tasks, // approved sessions = completed tasks
      basic_salary, bonus, final_payment_amount,
      bank_account_name, bank_name, branch_name, account_number_masked,
      payment_method, transaction_reference
    ]);

    // Mark attendances as paid
    await pool.query(`
      UPDATE task_attendances
      SET status = 'paid', updated_at = NOW()
      WHERE worker_id = $1 AND farm_id = $2 AND status = 'approved' AND TO_CHAR(date, 'FMMonth YYYY') = $3
    `, [workerId, farmId, payment_month]);

    // Send email to farmer
    const farmerRes = await pool.query('SELECT email, full_name FROM app_users WHERE id = $1', [workerId]);
    if (farmerRes.rows.length > 0) {
      const email = farmerRes.rows[0].email;
      const { sendSalaryPaymentEmail } = await import('../services/emailService.js');
      await sendSalaryPaymentEmail(email, {
        farmerName: farmerRes.rows[0].full_name,
        paymentMonth: payment_month,
        amount: final_payment_amount,
        paymentDate: payRes.rows[0].payment_date
      });
    }

    res.json({ message: 'Payment successful', payment: payRes.rows[0] });
  } catch (err) {
    console.error('Error paying salary:', err);
    res.status(500).json({ error: 'Failed to process payment' });
  }
}

export async function getMyEarnings(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    // Fetch monthly payments
    const payments = await pool.query(`
      SELECT * FROM monthly_salary_payments
      WHERE worker_id = $1 AND farm_id = $2
      ORDER BY payment_date DESC
    `, [userId, farmId]);

    // Summary of total paid
    const summary = await pool.query(`
      SELECT SUM(final_payment_amount) as total_paid
      FROM monthly_salary_payments
      WHERE worker_id = $1 AND farm_id = $2
    `, [userId, farmId]);

    // Fetch task attendances history for the worker
    const attendances = await pool.query(`
      SELECT ta.*, t.title as task_title 
      FROM task_attendances ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE ta.worker_id = $1 AND ta.farm_id = $2
      ORDER BY ta.date DESC, ta.created_at DESC
      LIMIT 30
    `, [userId, farmId]);

    res.json({
      payments: payments.rows,
      attendances: attendances.rows,
      summary: { paid_salary: summary.rows[0].total_paid || 0 }
    });
  } catch (err) {
    console.error('Error fetching earnings:', err);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
}
