import { pool } from '../db.js';

let feedbackTableReady = false;

async function ensureFeedbackTable() {
  if (feedbackTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      user_role VARCHAR(20) NOT NULL,
      feedback_type VARCHAR(20) NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      message TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_feedbacks_status_created_at
    ON feedbacks (status, created_at DESC);
  `);
  feedbackTableReady = true;
}

function normalizeRole(role) {
  return role === 'worker' ? 'Farmer' : role === 'customer' ? 'Customer' : role;
}

function normalizeFeedbackType(role, feedbackType) {
  if (feedbackType) return feedbackType;
  return role === 'customer' ? 'product' : 'system';
}

export async function submitFeedback(req, res) {
  try {
    await ensureFeedbackTable();
    const userId = req.user.userId;
    const role = req.user.role;
    if (!['customer', 'worker'].includes(role)) {
      return res.status(403).json({ error: 'Only customers and farmers can submit feedback.' });
    }

    const { rating, message, feedback_type } = req.body;
    const numericRating = parseInt(rating, 10);
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5.' });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message is required.' });
    }

    const result = await pool.query(
      `INSERT INTO feedbacks (user_id, user_role, feedback_type, rating, message, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [userId, normalizeRole(role), normalizeFeedbackType(role, feedback_type), numericRating, String(message).trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback.' });
  }
}

export async function getMyFeedback(req, res) {
  try {
    await ensureFeedbackTable();
    const userId = req.user.userId;
    const result = await pool.query(
      `SELECT f.*, u.full_name as user_name
       FROM feedbacks f
       JOIN app_users u ON u.id = f.user_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching my feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback.' });
  }
}

export async function getPublicVisibleFeedback(req, res) {
  try {
    await ensureFeedbackTable();
    const result = await pool.query(`
      SELECT f.id, f.user_role, f.feedback_type, f.rating, f.message, f.created_at, u.full_name as user_name
      FROM feedbacks f
      JOIN app_users u ON u.id = f.user_id
      WHERE f.status = 'visible'
      ORDER BY f.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching public feedback:', error);
    res.status(500).json({ error: 'Failed to fetch public feedback.' });
  }
}

export async function getAdminFeedback(req, res) {
  try {
    await ensureFeedbackTable();
    const { role, feedback_type, rating } = req.query;
    const where = [];
    const values = [];

    if (role && role !== 'all') {
      values.push(role);
      where.push(`LOWER(f.user_role) = LOWER($${values.length})`);
    }
    if (feedback_type && feedback_type !== 'all') {
      values.push(feedback_type);
      where.push(`LOWER(f.feedback_type) = LOWER($${values.length})`);
    }
    if (rating && rating !== 'all') {
      values.push(parseInt(rating, 10));
      where.push(`f.rating = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await pool.query(`
      SELECT f.*, u.full_name as user_name, u.email as user_email
      FROM feedbacks f
      JOIN app_users u ON u.id = f.user_id
      ${whereClause}
      ORDER BY f.created_at DESC
    `, values);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback.' });
  }
}

export async function updateFeedbackStatus(req, res) {
  try {
    await ensureFeedbackTable();
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'visible', 'hidden'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const result = await pool.query(
      `UPDATE feedbacks SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Feedback not found.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating feedback status:', error);
    res.status(500).json({ error: 'Failed to update feedback status.' });
  }
}

export async function deleteFeedback(req, res) {
  try {
    await ensureFeedbackTable();
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM feedbacks WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Feedback not found.' });
    }
    res.json({ message: 'Feedback deleted successfully.' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback.' });
  }
}
