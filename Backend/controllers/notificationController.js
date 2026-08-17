import { pool } from '../db.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { unreadOnly } = req.query;

    let query = `SELECT * FROM notifications WHERE user_id = $1`;
    const params = [userId];

    // CHANGE THIS
    if (unreadOnly === 'true') {
      query += ` AND read_at IS NULL`;
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Server error fetching notifications' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // CHANGE THIS
    const result = await pool.query(`
      UPDATE notifications
      SET read_at = NOW()
      WHERE id = $1
        AND user_id = $2
        AND read_at IS NULL
      RETURNING *
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({
      message: 'Marked as read',
      notification: result.rows[0]
    });

  } catch (err) {
    console.error('Error updating notification:', err);
    res.status(500).json({ error: 'Server error updating notification' });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    // CHANGE THIS
    await pool.query(`
      UPDATE notifications
      SET read_at = NOW()
      WHERE user_id = $1
        AND read_at IS NULL
    `, [userId]);

    res.json({ message: 'All marked as read' });

  } catch (err) {
    console.error('Error marking all as read:', err);
    res.status(500).json({ error: 'Server error' });
  }
};