import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

async function safeCount(queryText, fallbackColumn = 'count') {
  try {
    const result = await pool.query(queryText);
    return Number(result.rows[0]?.[fallbackColumn] || 0);
  } catch (error) {
    console.error('Overview query failed:', queryText.split('\n')[0], error.message);
    return 0;
  }
}

router.get('/overview', async (req, res) => {
  try {
    const [fieldsTotal, fieldsActive, fieldsUnderReview, farmers, customers, products, orders, livestockTotal, livestockHealthy, livestockFeedingDue] = await Promise.all([
      safeCount(`SELECT COUNT(*)::int AS count FROM farm_fields`),
      safeCount(`SELECT COUNT(*)::int AS count FROM farm_fields WHERE LOWER(COALESCE(status::text, '')) IN ('active', 'open', 'available')`),
      safeCount(`SELECT COUNT(*)::int AS count FROM farm_fields WHERE LOWER(COALESCE(status::text, '')) NOT IN ('active', 'open', 'available')`),
      safeCount(`SELECT COUNT(*)::int AS count FROM app_users WHERE LOWER(role::text) IN ('worker', 'farmer')`),
      safeCount(`SELECT COUNT(*)::int AS count FROM app_users WHERE LOWER(role::text) = 'customer'`),
      safeCount(`SELECT COUNT(*)::int AS count FROM products`),
      safeCount(`SELECT COUNT(*)::int AS count FROM orders`),
      safeCount(`SELECT COUNT(*)::int AS count FROM livestock_animals`),
      safeCount(`SELECT COUNT(*)::int AS count FROM livestock_animals WHERE LOWER(COALESCE(health_status::text, '')) = 'healthy'`),
      safeCount(`SELECT COUNT(*)::int AS count FROM livestock_animals WHERE LOWER(COALESCE(health_status::text, '')) IN ('watch', 'treatment')`),
    ]);

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
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview.' });
  }
});

export default router;
