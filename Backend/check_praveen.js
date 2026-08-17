import { pool } from './db.js';

pool.query(`
  SELECT t.id, t.title, t.completed_at, t.end_time, t.updated_at, t.working_hours, t.shift_id, t.completion_percentage, t.approved_progress
  FROM tasks t 
  JOIN app_users u ON t.assigned_to_user_id = u.id 
  WHERE u.full_name = 'praveen' AND t.shift_id = '099601bc-9eee-485d-b77a-27f91bc4838d'
`).then(res => {
  console.table(res.rows);
}).catch(console.error).finally(() => pool.end());
