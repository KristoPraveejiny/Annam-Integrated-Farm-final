import { pool } from '../db.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { unreadOnly } = req.query;

    let query = `SELECT * FROM notifications WHERE user_id = $1`;
    const params = [userId];

    if (unreadOnly === 'true') {
      query += ` AND read_status = false`;
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

    const result = await pool.query(`
      UPDATE notifications
      SET read_status = true
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Marked as read', notification: result.rows[0] });
  } catch (err) {
    console.error('Error updating notification:', err);
    res.status(500).json({ error: 'Server error updating notification' });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    await pool.query(`
      UPDATE notifications
      SET read_status = true
      WHERE user_id = $1 AND read_status = false
    `, [userId]);

    res.json({ message: 'All marked as read' });
  } catch (err) {
    console.error('Error marking all as read:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
