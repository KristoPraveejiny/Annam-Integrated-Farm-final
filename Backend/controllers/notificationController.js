import { pool } from '../db.js';

export async function getNotifications(req, res) {
  try {
    const userId = req.user.userId;
    const result = await pool.query(`
      SELECT * FROM notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

export async function markAsRead(req, res) {
  try {
    const userId = req.user.userId;
    const notificationId = req.params.id;
    await pool.query('UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2', [notificationId, userId]);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
}
