import fs from 'fs';
import path from 'path';

const controllerPath = path.join(process.cwd(), 'controllers', 'taskController.js');
let code = fs.readFileSync(controllerPath, 'utf8');

// 1. Add addActivityUpdate function
const addActivityUpdateCode = `
export async function addActivityUpdate(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const taskId = req.params.id;
    const { notes, activityType, progressPercentage, deviceInfo, networkStatus } = req.body;
    
    // Validate required fields
    if (!notes || notes.length < 20) {
      return res.status(400).json({ error: 'Description must be at least 20 characters.' });
    }
    
    // Process images
    const images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        images.push({
          url: \`/uploads/activities/\${file.filename}\`,
          fileName: file.originalname,
          size: file.size,
          uploadTime: new Date().toISOString()
        });
      }
    }
    
    if (images.length < 1 || images.length > 5) {
      return res.status(400).json({ error: 'Please upload between 1 and 5 images.' });
    }
    
    // Check time gap (10 minutes)
    const lastUpdateRes = await pool.query(
      'SELECT created_at, notes FROM task_updates WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1',
      [taskId]
    );
    
    if (lastUpdateRes.rows.length > 0) {
      const lastUpdate = lastUpdateRes.rows[0];
      const timeDiff = (new Date() - new Date(lastUpdate.created_at)) / 1000 / 60; // minutes
      if (timeDiff < 10) {
        return res.status(400).json({ error: 'You recently submitted an update. Please wait at least 10 minutes before submitting another.' });
      }
      if (lastUpdate.notes && lastUpdate.notes.trim().toLowerCase() === notes.trim().toLowerCase()) {
         return res.status(400).json({ error: 'This update looks similar to your previous activity description.' });
      }
    }
    
    const countRes = await pool.query('SELECT COUNT(*) FROM task_updates WHERE task_id = $1', [taskId]);
    const updateNumber = parseInt(countRes.rows[0].count, 10) + 1;
    
    const insertRes = await pool.query(
      \`INSERT INTO task_updates (task_id, farmer_id, notes, activity_type, progress_percentage, device_info, network_status, is_final, images, update_number) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8::jsonb, $9) RETURNING *\`,
      [taskId, userId, notes, activityType, parseInt(progressPercentage, 10) || 0, deviceInfo, networkStatus, JSON.stringify(images), updateNumber]
    );
    
    // Update task completion percentage
    await pool.query(
      'UPDATE tasks SET completion_percentage = GREATEST(completion_percentage, $1), total_updates = total_updates + 1, updated_at = NOW() WHERE id = $2 AND farm_id = $3',
      [parseInt(progressPercentage, 10) || 0, taskId, farmId]
    );
    
    // Notify manager
    const taskRes = await pool.query('SELECT title, created_by_user_id FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rows.length > 0) {
       const task = taskRes.rows[0];
       await pool.query(\`
          INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
          VALUES ($1, $2, $3, $4, $5, 'normal', 'Dashboard')
       \`, [task.created_by_user_id, farmId, 'ACTIVITY_UPDATE', 'New Activity Update', \`New update (\${progressPercentage}%) for task: \${task.title}\`]);
       
       if (req.io) {
          req.io.to(task.created_by_user_id).emit('notification', {
            title: 'New Activity Update',
            message: \`New update (\${progressPercentage}%) for task: \${task.title}\`,
            category: 'ACTIVITY_UPDATE',
            priority: 'normal'
          });
       }
    }
    
    res.status(201).json({ message: 'Activity update submitted successfully', update: insertRes.rows[0] });
  } catch (err) {
    console.error('Error adding activity update:', err);
    res.status(500).json({ error: 'Failed to add activity update' });
  }
}
`;

if (!code.includes('export async function addActivityUpdate')) {
  code += '\n' + addActivityUpdateCode;
}

// 2. Replace submitTaskEvidence
const oldSubmitTaskEvidence = /export async function submitTaskEvidence\(req, res\) \{[\s\S]*?catch \(err\) \{\s*console\.error\('Error submitting evidence:', err\);\s*res\.status\(500\)\.json\(\{ error: 'Failed to submit evidence' \}\);\s*\}\s*\}/;

const newSubmitTaskEvidence = `export async function submitTaskEvidence(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const taskId = req.params.id;
    const { notes, activityType, deviceInfo, networkStatus } = req.body;
    
    const images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        images.push({
          url: \`/uploads/activities/\${file.filename}\`,
          fileName: file.originalname,
          size: file.size,
          uploadTime: new Date().toISOString()
        });
      }
    }

    if (!notes && images.length === 0) {
        return res.status(400).json({ error: 'Evidence (notes or image) is required' });
    }

    const result = await pool.query(\`
      UPDATE tasks
      SET status = 'Waiting Manager Approval', 
          completed_at = NOW(), 
          end_time = NOW(),
          working_hours = EXTRACT(EPOCH FROM (NOW() - started_at))/3600,
          completion_percentage = 100,
          total_updates = total_updates + 1,
          updated_at = NOW()
      WHERE id = $1 AND farm_id = $2 AND assigned_to_user_id = $3 AND status = 'In Progress'
      RETURNING *
    \`, [taskId, farmId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found, unauthorized, or not In Progress' });
    }

    const task = result.rows[0];

    const countRes = await pool.query('SELECT COUNT(*) FROM task_updates WHERE task_id = $1', [taskId]);
    const updateNumber = parseInt(countRes.rows[0].count, 10) + 1;

    await pool.query(
      \`INSERT INTO task_updates (task_id, farmer_id, notes, activity_type, progress_percentage, device_info, network_status, is_final, images, update_number) 
       VALUES ($1, $2, $3, $4, 100, $5, $6, true, $7::jsonb, $8)\`,
      [taskId, userId, notes || null, activityType || 'Final Submission', deviceInfo, networkStatus, JSON.stringify(images), updateNumber]
    );

    const managerId = task.created_by_user_id;
    await pool.query(\`
      INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    \`, [
      managerId, farmId, 'TASK_EVIDENCE_SUBMITTED', 'Task Ready for Review',
      \`Final submission for task: \${task.title}. Waiting for your approval.\`, 'high', 'Dashboard'
    ]);

    if (req.io) {
      req.io.to(managerId).emit('notification', {
        title: 'Task Ready for Review',
        message: \`Final submission for task: \${task.title}. Waiting for your approval.\`,
        category: 'TASK_EVIDENCE_SUBMITTED',
        priority: 'high'
      });
    }

    res.json({ message: 'Task submitted successfully', task });
  } catch (err) {
    console.error('Error submitting evidence:', err);
    res.status(500).json({ error: 'Failed to submit evidence' });
  }
}`;

code = code.replace(oldSubmitTaskEvidence, newSubmitTaskEvidence);

// 3. Replace reviewTask
const oldReviewTask = /export async function reviewTask\(req, res\) \{[\s\S]*?catch \(err\) \{\s*console\.error\('Error reviewing task:', err\);\s*res\.status\(500\)\.json\(\{ error: 'Failed to review task' \}\);\s*\}\s*\}/;

const newReviewTask = `export async function reviewTask(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const taskId = req.params.id;
    const { action, reason } = req.body; // 'Approve', 'Approve & Comment', 'Request Evidence', 'Reject'

    if (!['Approve', 'Approve & Comment', 'Request Evidence', 'Reject', 'Rework'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (['Reject', 'Request Evidence', 'Rework', 'Approve & Comment'].includes(action) && !String(reason || '').trim()) {
      return res.status(400).json({ error: 'A comment/reason is required for this action' });
    }

    let status = 'Completed';
    if (action === 'Reject') status = 'Rejected';
    if (action === 'Request Evidence' || action === 'Rework') status = 'Rework Requested';

    const taskLookup = await pool.query(\`SELECT * FROM tasks WHERE id = $1 AND farm_id = $2 LIMIT 1\`, [taskId, farmId]);

    if (taskLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }

    const task = taskLookup.rows[0];
    
    // Calculate Score if Approving
    let activityScore = task.activity_score || 0;
    if (status === 'Completed') {
      const updatesRes = await pool.query('SELECT COUNT(*) as count, SUM(jsonb_array_length(images)) as img_count FROM task_updates WHERE task_id = $1', [taskId]);
      const updatesCount = parseInt(updatesRes.rows[0].count, 10) || 0;
      const imgCount = parseInt(updatesRes.rows[0].img_count, 10) || 0;
      
      let sImage = Math.min(imgCount * 10, 20); 
      let sUpdate = Math.min(updatesCount * 5, 20);
      let sNotes = 20; // assuming final notes exist
      let sProgress = task.completion_percentage === 100 ? 20 : 0;
      let sReview = 20; // base score for approval
      
      activityScore = sImage + sUpdate + sNotes + sProgress + sReview;
    }

    const result = await pool.query(\`
      UPDATE tasks
      SET status = $1, activity_score = $2, updated_at = NOW()
      WHERE id = $3 AND farm_id = $4
      RETURNING *
    \`, [status, activityScore, taskId, farmId]);

    const updatedTask = result.rows[0] || task;
    const workerId = task.assigned_to_user_id;
    const attendanceDate = normalizeDateInput(updatedTask.completed_at || updatedTask.end_time || updatedTask.updated_at || new Date()) || new Date().toISOString().slice(0, 10);

    // Save to task_reviews history
    await pool.query(\`
      INSERT INTO task_reviews (task_id, manager_id, action, comments)
      VALUES ($1, $2, $3, $4)
    \`, [taskId, userId, action, reason || null]);

    // Insert Audit Log
    await pool.query(\`
      INSERT INTO audit_logs (user_id, user_role, module, action, record_id, new_value)
      VALUES ($1, 'Farm Manager', 'Task Management', 'Review Task', $2, $3)
    \`, [userId, taskId, JSON.stringify({ status, reason: reason || null, activityScore })]);

    // If Approved, Mark Attendance
    if (status === 'Completed') {
        const checkInTime = updatedTask.start_time || updatedTask.started_at;
        const checkOutTime = updatedTask.end_time || updatedTask.completed_at;

        const existingAttendance = await pool.query(
          \`SELECT id FROM shift_attendances WHERE worker_id = $1 AND shift_id = $3 AND date = $2::date LIMIT 1\`,
          [workerId, attendanceDate, updatedTask.shift_id]
        );

        if (existingAttendance.rows.length > 0) {
          await pool.query(\`
            UPDATE shift_attendances SET check_in_time = $1, check_out_time = $2, total_hours = $3, shift_status = 'Present', updated_at = NOW() WHERE id = $4
          \`, [checkInTime, checkOutTime, updatedTask.working_hours, existingAttendance.rows[0].id]);
        } else {
          await pool.query(\`
            INSERT INTO shift_attendances (worker_id, date, shift_id, check_in_time, check_out_time, total_hours, shift_status, farm_id)
            VALUES ($1, $2::date, $3, $4, $5, $6, 'Present', $7)
          \`, [workerId, attendanceDate, updatedTask.shift_id, checkInTime, checkOutTime, updatedTask.working_hours, farmId]);
        }

        await upsertMonthlyPayrollAfterApproval({ farmId, managerId: userId, workerId, effectiveDate: attendanceDate });
    }

    await notifyFarmerOfReview({ workerId, task: updatedTask, action, reason });

    // Notify worker
    await pool.query(\`
      INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
      VALUES ($1, $2, $3, $4, $5, 'high', 'Dashboard')
    \`, [workerId, farmId, 'TASK_REVIEWED', 'Task Review Completed', \`Your task "\${updatedTask.title}" has been \${status}.\`]);

    if (req.io) {
      req.io.to(workerId).emit('notification', {
        title: 'Task Review Completed',
        message: \`Your task "\${updatedTask.title}" has been \${status}.\`,
        category: 'TASK_REVIEWED',
        priority: 'high'
      });
    }

    res.json({ message: \`Task \${status} successfully\`, task: updatedTask });
  } catch (err) {
    console.error('Error reviewing task:', err);
    res.status(500).json({ error: 'Failed to review task' });
  }
}`;

code = code.replace(oldReviewTask, newReviewTask);

// Also we need to export addActivityUpdate in getRecentTaskUpdates query, let's update that query to fetch the new fields
const oldGetRecent = /SELECT tu\.id, tu\.notes, tu\.image_url, tu\.created_at,/;
const newGetRecent = "SELECT tu.id, tu.notes, tu.images, tu.image_url, tu.activity_type, tu.progress_percentage, tu.is_final, tu.created_at, tu.update_number,";
code = code.replace(oldGetRecent, newGetRecent);

fs.writeFileSync(controllerPath, code);
console.log('taskController updated');
