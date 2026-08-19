import { pool } from '../db.js';
import cron from 'node-cron';
import { sendEmail } from '../services/emailService.js';

// Run every minute for testing
cron.schedule('* * * * *', async () => {
  console.log('Running workforce cron checks...');

  try {
    const now = new Date();

    // 1. Missed Shift Detection (never started tasks)
    // Shift ended, task not started
    const targetMissed = await pool.query(`
      SELECT id, status, title, assigned_to_user_id, farm_id, shift_end_time, shift_id
      FROM tasks
      WHERE LOWER(status) IN ('todo', 'pending', 'assigned', 'accepted') 
        AND COALESCE(shift_end_time, due_date + INTERVAL '1 day') < NOW()
    `);

    for (const task of targetMissed.rows) {
      // Update status
      await pool.query(`
        UPDATE tasks
        SET status = 'missed_shift', updated_at = NOW()
        WHERE id = $1
      `, [task.id]);

      console.log(`Task ${task.id} marked as missed_shift (never started)`);
      
      // Timeline (correcting bug: task.status was updated row's status)
      await pool.query(`
        INSERT INTO task_timeline (task_id, action, previous_status, new_status, reason)
        VALUES ($1, $2, $3, $4, $5)
      `, [task.id, 'System Cron', task.status, 'missed_shift', 'Shift ended without worker starting']);

      // Notify worker and manager
      if (task.assigned_to_user_id) {
        await pool.query(`
          INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
          VALUES ($1, $2, $3, $4, $5, 'high', 'Dashboard')
        `, [task.assigned_to_user_id, task.farm_id, 'MISSED_SHIFT', 'Missed Shift', `You missed your shift for task: ${task.title}`]);

        // Get user details for email
        const userRes = await pool.query('SELECT email FROM app_users WHERE id = $1', [task.assigned_to_user_id]);
        if (userRes.rows.length > 0 && userRes.rows[0].email) {
          const messageText = `You missed your shift for task: ${task.title}. Shift ended without starting the task.`;
          await sendEmail({
            to: userRes.rows[0].email,
            subject: 'Missed Shift Notification',
            text: messageText,
            html: `<p>${messageText}</p>`
          });
        }

        // Mark attendance as Absent (only if no attendance row exists yet for this worker+shift+day)
        const attendanceDate = task.shift_end_time
          ? new Date(task.shift_end_time).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        const existingAttendance = await pool.query(
          `SELECT id FROM shift_attendances WHERE worker_id = $1 AND date = $2::date AND shift_id = $3 LIMIT 1`,
          [task.assigned_to_user_id, attendanceDate, task.shift_id]
        );
        if (existingAttendance.rows.length === 0) {
          await pool.query(`
            INSERT INTO shift_attendances (worker_id, date, shift_id, check_in_time, check_out_time, total_hours, shift_status, farm_id)
            VALUES ($1, $2::date, $3, NULL, NULL, 0, 'Absent', $4)
          `, [task.assigned_to_user_id, attendanceDate, task.shift_id, task.farm_id]);
        }
      }
    }

    // 2. Smart Shift End Detection
    // Task in_progress, shift ended -> work_pending_confirmation
    // Immediately send email and notification upon transitioning.
    const targetPendingConf = await pool.query(`
      SELECT t.id, t.status, t.title, t.assigned_to_user_id, t.farm_id, t.shift_end_time, t.shift_id, u.email
      FROM tasks t
      LEFT JOIN app_users u ON t.assigned_to_user_id = u.id
      WHERE LOWER(REPLACE(t.status, ' ', '_')) = 'in_progress'
        AND COALESCE(t.shift_end_time, t.due_date + INTERVAL '1 day') < NOW()
    `);

    for (const task of targetPendingConf.rows) {
      await pool.query(`
        UPDATE tasks
        SET status = 'work_pending_confirmation', updated_at = NOW()
        WHERE id = $1
      `, [task.id]);

      console.log(`Task ${task.id} marked as work_pending_confirmation`);

      // Timeline
      await pool.query(`
        INSERT INTO task_timeline (task_id, action, previous_status, new_status, reason)
        VALUES ($1, $2, $3, $4, $5)
      `, [task.id, 'System Cron', 'in_progress', 'work_pending_confirmation', 'Shift ended, waiting for evidence']);

      // Notify worker immediately (Dashboard and Email)
      if (task.assigned_to_user_id) {
        const message = `Your Morning Shift has ended. Please upload work evidence within the next 1 hour grace period for task: ${task.title}`;
        
        await pool.query(`
          INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
          VALUES ($1, $2, $3, $4, $5, 'high', 'Dashboard')
        `, [task.assigned_to_user_id, task.farm_id, 'PENDING_EVIDENCE', 'Evidence Required', message]);

        if (task.email) {
          await sendEmail({
            to: task.email,
            subject: 'Action Required: Submit Task Evidence (1 Hour Grace Period)',
            text: message,
            html: `<p>${message}</p>`
          });
        }
      }
    }

    // 3. Grace Period & Missed Shift transition
    // Task work_pending_confirmation, 1-hour grace period passed -> missed_shift
    const targetGraceEnded = await pool.query(`
      SELECT t.id, t.status, t.title, t.assigned_to_user_id, t.farm_id, t.shift_end_time, t.shift_id, t.created_by_user_id, u.email
      FROM tasks t
      LEFT JOIN app_users u ON t.assigned_to_user_id = u.id
      WHERE LOWER(t.status) = 'work_pending_confirmation'
        AND COALESCE(t.shift_end_time, t.due_date + INTERVAL '1 day') + INTERVAL '1 hour' < NOW()
    `);

    for (const task of targetGraceEnded.rows) {
      // Update status to missed_shift
      await pool.query(`
        UPDATE tasks
        SET status = 'missed_shift', updated_at = NOW()
        WHERE id = $1
      `, [task.id]);

      console.log(`Task ${task.id} marked as missed_shift (Grace period passed)`);

      // Timeline
      await pool.query(`
        INSERT INTO task_timeline (task_id, actor_id, action, previous_status, new_status, reason)
        VALUES ($1, NULL, $2, $3, $4, $5)
      `, [task.id, 'System Cron', 'work_pending_confirmation', 'missed_shift', 'Grace period ended without evidence submission']);

      // Notify worker and manager
      if (task.assigned_to_user_id) {
        const message = `You missed your shift for task: ${task.title}. You failed to upload evidence within the 1-hour grace period.`;
        
        await pool.query(`
          INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
          VALUES ($1, $2, $3, $4, $5, 'high', 'Dashboard')
        `, [task.assigned_to_user_id, task.farm_id, 'MISSED_SHIFT', 'Missed Shift', message]);

        if (task.email) {
          await sendEmail({
            to: task.email,
            subject: 'Shift Marked as Missed (Grace Period Expired)',
            text: message,
            html: `<p>${message}</p>`
          });
        }

        // Mark attendance as Absent (only if no attendance row exists yet for this worker+shift+day)
        const attendanceDate = task.shift_end_time
          ? new Date(task.shift_end_time).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        const existingAttendance = await pool.query(
          `SELECT id FROM shift_attendances WHERE worker_id = $1 AND date = $2::date AND shift_id = $3 LIMIT 1`,
          [task.assigned_to_user_id, attendanceDate, task.shift_id]
        );
        if (existingAttendance.rows.length === 0) {
          await pool.query(`
            INSERT INTO shift_attendances (worker_id, date, shift_id, check_in_time, check_out_time, total_hours, shift_status, farm_id)
            VALUES ($1, $2::date, $3, NULL, NULL, 0, 'Absent', $4)
          `, [task.assigned_to_user_id, attendanceDate, task.shift_id, task.farm_id]);
        }
      }

      // Notify manager
      if (task.created_by_user_id) {
        await pool.query(`
          INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
          VALUES ($1, $2, $3, $4, $5, 'high', 'Dashboard')
        `, [task.created_by_user_id, task.farm_id, 'MISSED_SHIFT', 'Worker Failed to Upload Evidence', `Worker failed to upload evidence for task: ${task.title} within the 1-hour grace period.`]);
      }
    }
  } catch (err) {
    console.error('Error in workforce cron:', err);
  }
});
