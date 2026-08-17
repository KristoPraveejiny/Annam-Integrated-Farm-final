import { Router } from 'express';
import { verifyToken } from '../authMiddleware.js';
import { pool } from '../db.js';
import { getDefaultFarmId } from '../controllers/livestockController.js';
import { syncAttendanceFromCompletedTasks } from '../controllers/taskController.js';

const router = Router();

async function safeCount(queryText, fallbackColumn = 'count', params = []) {
  try {
    const result = await pool.query(queryText, params);
    return Number(result.rows[0]?.[fallbackColumn] || 0);
  } catch (error) {
    console.error('Overview query failed:', queryText.split('\n')[0], error.message);
    return 0;
  }
}

router.get('/overview', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const [
      fieldsTotal, fieldsActive, fieldsUnderReview, farmers, customers, products, orders, livestockTotal, livestockHealthy, livestockFeedingDue,
      cropsReady, harvestToday, harvestWeek, harvestMonth, harvestOverdue, totalAreaResult, expectedYieldResult
    ] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS count FROM farm_fields WHERE farm_id = $1`, 'count', [farmId]),
      safeCount(`SELECT COUNT(*)::int AS count FROM farm_fields WHERE farm_id = $1 AND LOWER(COALESCE(status::text, '')) IN ('active', 'open', 'available')`, 'count', [farmId]),
      safeCount(`SELECT COUNT(*)::int AS count FROM farm_fields WHERE farm_id = $1 AND LOWER(COALESCE(status::text, '')) NOT IN ('active', 'open', 'available')`, 'count', [farmId]),
      safeCount(`SELECT COUNT(DISTINCT u.id)::int AS count FROM app_users u JOIN farm_memberships fm ON fm.user_id = u.id WHERE fm.farm_id = $1 AND LOWER(u.role::text) IN ('worker', 'farmer')`, 'count', [farmId]),
      safeCount(`SELECT COUNT(DISTINCT u.id)::int AS count FROM app_users u JOIN farm_memberships fm ON fm.user_id = u.id WHERE fm.farm_id = $1 AND LOWER(u.role::text) = 'customer'`, 'count', [farmId]),
      safeCount(`SELECT COUNT(*)::int AS count FROM products WHERE farm_id = $1`, 'count', [farmId]),
      safeCount(`SELECT COUNT(*)::int AS count FROM orders WHERE farm_id = $1`, 'count', [farmId]),
      safeCount(`SELECT COUNT(*)::int AS count FROM livestock_animals WHERE farm_id = $1`, 'count', [farmId]),
      safeCount(`SELECT COUNT(*)::int AS count FROM livestock_animals WHERE farm_id = $1 AND LOWER(COALESCE(health_status::text, '')) = 'healthy'`, 'count', [farmId]),
      safeCount(`SELECT COUNT(*)::int AS count FROM livestock_animals WHERE farm_id = $1 AND LOWER(COALESCE(health_status::text, '')) IN ('watch', 'treatment')`, 'count', [farmId]),
      safeCount(`SELECT COUNT(*)::int AS count FROM crop_cycles WHERE farm_id = $1 AND harvest_status = 'Ready for Harvest' AND is_historical = FALSE`, 'count', [farmId]),
      safeCount(`SELECT COUNT(*)::int AS count FROM crop_cycles WHERE farm_id = $1 AND remaining_days = 0 AND harvest_status != 'Harvested' AND harvest_status != 'Overdue' AND is_historical = FALSE`, 'count', [farmId]),
      safeCount(`SELECT COUNT(*)::int AS count FROM crop_cycles WHERE farm_id = $1 AND remaining_days > 0 AND remaining_days <= 7 AND is_historical = FALSE`, 'count', [farmId]),
      safeCount(`SELECT COUNT(*)::int AS count FROM crop_cycles WHERE farm_id = $1 AND remaining_days > 0 AND remaining_days <= 30 AND is_historical = FALSE`, 'count', [farmId]),
      safeCount(`SELECT COUNT(*)::int AS count FROM crop_cycles WHERE farm_id = $1 AND harvest_status = 'Overdue' AND is_historical = FALSE`, 'count', [farmId]),
      safeCount(`SELECT SUM(CAST(REGEXP_REPLACE(area, '[^0-9.]', '', 'g') AS NUMERIC)) as sum FROM farm_fields WHERE farm_id = $1 AND status = 'active'`, 'sum', [farmId]),
      safeCount(`SELECT SUM(expected_yield) as sum FROM crop_cycles WHERE farm_id = $1 AND harvest_status != 'Harvested' AND is_historical = FALSE AND expected_yield IS NOT NULL`, 'sum', [farmId]),
    ]);

    const totalArea = totalAreaResult || 0;
    const expectedYield = expectedYieldResult || 0;

    res.json({
      totalFields: fieldsTotal,
      activeFields: fieldsActive,
      fieldsUnderReview,
      farmers,
      customers,
      products,
      orders,
      livestock: {
        total: livestockTotal,
        healthy: livestockHealthy,
        feedingDue: livestockFeedingDue,
      },
      harvestAnalytics: {
        cropsReady,
        harvestToday,
        harvestWeek,
        harvestMonth,
        harvestOverdue,
        totalArea,
        expectedYield
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard overview.' });
  }
});

router.get('/workforce', async (req, res) => {
  try {
    // We can assume user is farm manager or admin from auth middleware
    // Fetch metrics: Today's Workforce, Tasks, Present Workers, etc.
    const today = new Date().toISOString().split('T')[0];

    const totalWorkers = await safeCount(`SELECT COUNT(*)::int AS count FROM app_users WHERE LOWER(role::text) IN ('worker', 'farmer')`);
    const presentWorkers = await safeCount(`SELECT COUNT(DISTINCT worker_id)::int AS count FROM shift_attendances WHERE date = '${today}'`);
    const leaves = await safeCount(`SELECT COUNT(DISTINCT worker_id)::int AS count FROM shift_attendances WHERE date = '${today}' AND shift_status = 'Leave'`);
    
    const tasksAssigned = await safeCount(`SELECT COUNT(*)::int AS count FROM tasks WHERE status = 'Pending'`);
    const tasksInProgress = await safeCount(`SELECT COUNT(*)::int AS count FROM tasks WHERE status = 'In Progress'`);
    const tasksWaiting = await safeCount(`SELECT COUNT(*)::int AS count FROM tasks WHERE status IN ('Waiting Manager Approval', 'Waiting for Manager Approval')`);
    const tasksCompleted = await safeCount(`SELECT COUNT(*)::int AS count FROM tasks WHERE status IN ('Completed', 'Approved')`);
    
    // AI Mock Insight
    const aiInsight = "Rain is expected tomorrow afternoon. Recommend assigning harvesting tasks to the morning shift.";

    res.json({
      metrics: {
        totalWorkers,
        presentWorkers,
        leaves,
        tasksAssigned,
        tasksInProgress,
        tasksWaiting,
        tasksCompleted,
      },
      aiInsight
    });
  } catch (error) {
    console.error('Error fetching workforce overview:', error);
    res.status(500).json({ error: 'Failed to fetch workforce overview.' });
  }
});

router.get('/workforce-attendance', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const now = new Date();

    await syncAttendanceFromCompletedTasks({
      farmId,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });

    const [recentAttendanceRes, recentPayrollRes] = await Promise.all([
      pool.query(`
        SELECT
          sa.id,
          sa.date,
          sa.total_hours,
          sa.shift_status,
          sa.check_in_time,
          sa.check_out_time,
          u.full_name as farmer_name,
          t.title as task_title,
          COALESCE(s.shift_name, t.session::text) as session,
          ROUND(COALESCE(s.base_wage, 0)::numeric, 2) as shift_wage,
          ROUND(
            GREATEST(COALESCE(sa.total_hours, 0) - COALESCE(s.standard_hours, 0), 0)
            * COALESCE(NULLIF(s.base_wage, 0) / NULLIF(s.standard_hours, 0), s.hourly_rate, 0)
          ::numeric, 2) as overtime_pay
        FROM shift_attendances sa
        JOIN app_users u ON sa.worker_id = u.id
        LEFT JOIN shifts s ON sa.shift_id = s.id
        LEFT JOIN tasks t ON t.assigned_to_user_id = sa.worker_id
          AND t.shift_id = sa.shift_id
          AND DATE(COALESCE(t.completed_at, t.end_time, t.updated_at)) = DATE(sa.date)
        WHERE sa.farm_id = $1
        ORDER BY sa.date DESC, sa.created_at DESC
        LIMIT 10
      `, [farmId]),
      pool.query(`
        SELECT
          p.id,
          p.worker_id,
          u.full_name as farmer_name,
          p.payment_month,
          p.present_days,
          p.total_working_hours,
          p.morning_shifts,
          p.afternoon_shifts,
          p.evening_shifts,
          p.hourly_wage_total,
          p.base_salary,
          p.overtime,
          p.gross_salary,
          p.net_salary,
          p.payment_status
        FROM monthly_salary_payments p
        JOIN app_users u ON p.worker_id = u.id
        WHERE p.farm_id = $1
        ORDER BY p.created_at DESC
        LIMIT 10
      `, [farmId]),
    ]);

    res.json({
      recentAttendance: recentAttendanceRes.rows,
      recentPayrolls: recentPayrollRes.rows,
    });
  } catch (error) {
    console.error('Error fetching workforce attendance summary:', error);
    res.status(500).json({ error: 'Failed to fetch workforce attendance summary.' });
  }
});

export default router;
