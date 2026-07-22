import fs from 'fs';
import path from 'path';

const controllerPath = path.join(process.cwd(), 'controllers', 'salaryController.js');
let code = fs.readFileSync(controllerPath, 'utf8');

const getMyEarningsRegex = /export const getMyEarnings = async \(req, res\) \{[\s\S]*?catch \(err\) \{\s*console\.error\('Error fetching my earnings:', err\);\s*res\.status\(500\)\.json\(\{ error: 'Failed to fetch earnings' \}\);\s*\}\s*\};/;

const newGetMyEarnings = `export const getMyEarnings = async (req, res) => {
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
      pool.query(\`SELECT full_name FROM app_users WHERE id = $1 LIMIT 1\`, [userId]),
      pool.query(\`
        SELECT p.*, u.full_name as worker_name
        FROM monthly_salary_payments p
        JOIN app_users u ON p.worker_id = u.id
        WHERE p.farm_id = $1 AND p.worker_id = $2
        ORDER BY p.payment_month DESC, p.created_at DESC
      \`, [farmId, userId]),
      pool.query(\`
        SELECT p.*, u.full_name as worker_name
        FROM monthly_salary_payments p
        JOIN app_users u ON p.worker_id = u.id
        WHERE p.farm_id = $1 AND p.worker_id = $2 AND p.payment_month = $3
        LIMIT 1
      \`, [farmId, userId, paymentMonth]),
      pool.query(\`
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
      \`, [farmId, userId, month, year]),
      pool.query(\`
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
      \`, [farmId, userId, month, year]),
      pool.query(\`
        SELECT sl.*, t.title as task_title
        FROM salary_ledger sl
        JOIN tasks t ON sl.task_id = t.id
        WHERE sl.farm_id = $1 AND sl.worker_id = $2
          AND EXTRACT(MONTH FROM sl.date) = $3
          AND EXTRACT(YEAR FROM sl.date) = $4
        ORDER BY sl.created_at DESC
      \`, [farmId, userId, month, year])
    ]);

    const workerName = userRes.rows[0]?.full_name || currentPaymentRes.rows[0]?.worker_name || paymentsRes.rows[0]?.worker_name || '';
    const currentPayment = currentPaymentRes.rows[0] || {};
    const payrollSummary = summaryRes.rows[0] || {};
    const approvedAdvances = await getApprovedAdvanceTotal({ farmId, workerId: userId, payrollMonth: paymentMonth });
    
    let ledgerEarnings = 0;
    ledgerRes.rows.forEach(l => {
      ledgerEarnings += Number(l.amount || 0);
    });

    const attendanceMetrics = calculatePayrollMetrics(attendanceRes.rows, {
      month,
      year,
      bonus: Number(currentPayment.bonus ?? currentPayment.bonus_amount ?? 0),
      deductions: Number(currentPayment.deductions ?? 0) + approvedAdvances,
    });
    
    const summary = {
      payment_month: paymentMonth,
      month_label: new Date(\`\${paymentMonth}-01\`).toLocaleString(undefined, { month: 'long', year: 'numeric' }),
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
      ledger_earnings: ledgerEarnings,
      bonus: attendanceMetrics.bonus,
      deductions: attendanceMetrics.deductions,
      gross_salary: attendanceMetrics.grossSalary + ledgerEarnings,
      net_salary: attendanceMetrics.netSalary + ledgerEarnings,
      paid_salary: Number(currentPayment.final_payment_amount ?? currentPayment.net_salary ?? (attendanceMetrics.netSalary + ledgerEarnings)),
    };

    res.json({
      summary,
      attendances: attendanceRes.rows,
      payments: paymentsRes.rows,
      ledger: ledgerRes.rows
    });
  } catch (err) {
    console.error('Error fetching my earnings:', err);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
};`;

code = code.replace(getMyEarningsRegex, newGetMyEarnings);

fs.writeFileSync(controllerPath, code);
console.log('salaryController updated successfully');
