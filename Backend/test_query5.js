import { pool } from './db.js';
pool.query(`
UPDATE shift_attendances sa 
SET check_out_time = (
  SELECT created_at 
  FROM task_updates tu 
  WHERE tu.task_id = (
    SELECT t.id FROM tasks t 
    WHERE t.shift_id = sa.shift_id 
    AND t.assigned_to_user_id = sa.worker_id 
    LIMIT 1
  ) 
  AND tu.progress_percentage = 100 
  ORDER BY created_at DESC 
  LIMIT 1
) 
WHERE sa.total_hours = 0 OR sa.total_hours IS NULL 
RETURNING *
`).then(res => console.log(res.rows)).catch(console.error).finally(() => pool.end());
