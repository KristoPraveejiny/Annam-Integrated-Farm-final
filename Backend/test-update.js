import('./db.js').then(async ({pool}) => {
  const eventRes = await pool.query('SELECT id, farm_id FROM livestock_health_events ORDER BY created_at DESC LIMIT 1');
  const event = eventRes.rows[0];
  console.log('Event:', event);
  const result = await pool.query(
    'UPDATE livestock_health_events SET diagnosis = $1, treatment = $2 WHERE id = $3 AND farm_id = $4 RETURNING *',
    ['Test Diagnosis Node', 'Test Treatment Node', event.id, event.farm_id]
  );
  console.log('Update result rows:', result.rows.length);
  process.exit();
}).catch(console.error);
