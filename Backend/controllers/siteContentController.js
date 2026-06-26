import { pool } from '../db.js';

export async function getSiteContent(req, res) {
  try {
    const result = await pool.query(`
      SELECT setting_key, setting_value, scope
      FROM system_settings
      WHERE (scope = 'home' AND setting_key IN ('home_hero', 'home_about'))
         OR (scope = 'about' AND setting_key IN ('about_page'))
      ORDER BY scope, setting_key
    `);

    const content = {};
    for (const row of result.rows) {
      content[`${row.scope}.${row.setting_key}`] = row.setting_value;
    }

    res.json(content);
  } catch (error) {
    console.error('Error fetching site content:', error);
    res.status(500).json({ error: 'Failed to fetch site content.' });
  }
}
