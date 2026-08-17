import { pool } from '../db.js';

export const getAuditLogs = async (req, res) => {
  try {
    const { module, action, limit = 50 } = req.query;

    let query = `
      SELECT a.*, u.full_name as user_name
      FROM audit_logs a
      LEFT JOIN app_users u ON a.actor_user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (module) {
      params.push(module);
      query += ` AND a.module = $${params.length}`;
    }

    if (action) {
      params.push(action);
      query += ` AND a.action = $${params.length}`;
    }

    query += ` ORDER BY a.timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Server error fetching audit logs' });
  }
};
