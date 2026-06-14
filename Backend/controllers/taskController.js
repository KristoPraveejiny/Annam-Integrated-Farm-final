import { pool } from '../db.js';
import { sendTaskAssignedEmail, sendTaskCompletedEmail, sendTaskUpdateEmail } from '../services/emailService.js';
import { getDefaultFarmId } from './livestockController.js';

export async function getWorkers(req, res) {
  try {
    const userId = req.user.userId;
    // For now we just return users with role 'worker'
    // Ideally, we'd join with farm_workers table, but if there isn't one, this works as mock
    const result = await pool.query(`SELECT id, full_name as name FROM app_users WHERE role::text IN ('worker', 'farmer')`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching workers:', err);
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
}

export async function createTask(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const {
      title,
      description,
      cropCycleId,
      assignedToUserId,
      priority,
      dueDate,
      livestockGroupId
    } = req.body;

    if (!title || !assignedToUserId) {
      return res.status(400).json({ error: 'Title and assignedToUserId are required' });
    }

    // Insert task
    const result = await pool.query(`
      INSERT INTO tasks 
      (farm_id, title, description, crop_cycle_id, livestock_group_id, assigned_to_user_id, created_by_user_id, priority, due_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'todo')
      RETURNING *
    `, [
      farmId,
      title,
      description || null,
      cropCycleId || null,
      livestockGroupId || null,
      assignedToUserId,
      userId,
      priority || 'medium',
      dueDate || null
    ]);

    const task = result.rows[0];

    // Fetch farmer email and crop details for email
    const farmerRes = await pool.query('SELECT email, full_name FROM app_users WHERE id = $1', [assignedToUserId]);
    
    let cropName = 'N/A';
    if (cropCycleId) {
      const cropRes = await pool.query('SELECT crop_name FROM crop_cycles WHERE id = $1', [cropCycleId]);
      if (cropRes.rows.length > 0) {
        cropName = cropRes.rows[0].crop_name;
      }
    } else if (livestockGroupId) {
      const liveRes = await pool.query('SELECT group_code, species FROM livestock_groups WHERE id = $1', [livestockGroupId]);
      if (liveRes.rows.length > 0) {
        cropName = `${liveRes.rows[0].species} (${liveRes.rows[0].group_code})`;
      }
    }

    if (farmerRes.rows.length > 0) {
      const farmerEmail = farmerRes.rows[0].email;
      await sendTaskAssignedEmail(farmerEmail, {
        title,
        description,
        priority,
        dueDate,
        relatedEntity: cropName
      });

      // Insert notification
      await pool.query(`
        INSERT INTO notifications (user_id, farm_id, type, title, message, priority)
        VALUES ($1, $2, 'TASK_ASSIGNED', 'New Task Assigned', $3, 'high')
      `, [assignedToUserId, farmId, `You have been assigned a new task: ${title}`]);
    }

    res.status(201).json({ message: 'Task created successfully', task });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
}

export async function getFarmerTasks(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const result = await pool.query(`
      SELECT t.*, c.crop_name, c.variety, l.species as livestock_name
      FROM tasks t
      LEFT JOIN crop_cycles c ON t.crop_cycle_id = c.id
      LEFT JOIN livestock_groups l ON t.livestock_group_id = l.id
      WHERE t.farm_id = $1 AND t.assigned_to_user_id = $2
      ORDER BY t.created_at DESC
    `, [farmId, userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching farmer tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

export async function getFarmManagerTasks(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const result = await pool.query(`
      SELECT t.*, u.full_name as assigned_to_name, c.crop_name, l.species as livestock_name
      FROM tasks t
      LEFT JOIN app_users u ON t.assigned_to_user_id = u.id
      LEFT JOIN crop_cycles c ON t.crop_cycle_id = c.id
      LEFT JOIN livestock_groups l ON t.livestock_group_id = l.id
      WHERE t.farm_id = $1
      ORDER BY t.created_at DESC
    `, [farmId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching farm tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

export async function updateTaskStatus(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const taskId = req.params.id;
    const { status } = req.body;

    if (!['todo', 'in_progress', 'blocked', 'done', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    let query = `
      UPDATE tasks
      SET status = $1, updated_at = NOW()
    `;
    const params = [status, taskId, farmId, userId];
    
    if (status === 'in_progress') {
      query += `, started_at = NOW()`;
    } else if (status === 'done') {
      query += `, completed_at = NOW()`;
    }

    // We only allow the assigned farmer or the farm manager (we just check farm_id for simplicity, assuming auth middleware handles manager check if needed, but here we require assigned_to_user_id or created_by_user_id for now, or just farm_id)
    query += ` WHERE id = $2 AND farm_id = $3 AND (assigned_to_user_id = $4 OR created_by_user_id = $4) RETURNING *`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }

    const task = result.rows[0];

    // If done, notify manager
    if (status === 'done') {
      // Get manager and crop details
      const managerRes = await pool.query('SELECT email FROM app_users WHERE id = $1', [task.created_by_user_id]);
      const farmerRes = await pool.query('SELECT full_name FROM app_users WHERE id = $1', [userId]);
      
      let cropName = 'N/A';
      if (task.crop_cycle_id) {
        const cropRes = await pool.query('SELECT crop_name FROM crop_cycles WHERE id = $1', [task.crop_cycle_id]);
        if (cropRes.rows.length > 0) cropName = cropRes.rows[0].crop_name;
      }

      const farmerName = farmerRes.rows[0]?.full_name || 'Unknown Farmer';

      if (managerRes.rows.length > 0) {
        const managerEmail = managerRes.rows[0].email;
        await sendTaskCompletedEmail(managerEmail, {
          title: task.title,
          relatedEntity: cropName,
          completedBy: farmerName,
          completedAt: task.completed_at
        });

        // Add db notification
        await pool.query(`
          INSERT INTO notifications (user_id, farm_id, type, title, message, priority)
          VALUES ($1, $2, 'TASK_COMPLETED', 'Task Completed', $3, 'normal')
        `, [task.created_by_user_id, farmId, `Task "${task.title}" was completed by ${farmerName}.`]);
      }
    }

    res.json({ message: 'Task updated successfully', task });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
}
// Handle farmer's activity update (notes + optional image)
export async function createTaskUpdate(req, res) {
  try {
    const userId = req.user.userId;
    const taskId = req.params.id;
    const { notes } = req.body;
    const imageUrl = req.file ? `/uploads/activities/${req.file.filename}` : null;

    // Verify task belongs to the same farm
    const farmId = await getDefaultFarmId(userId);
    const taskRes = await pool.query('SELECT id FROM tasks WHERE id = $1 AND farm_id = $2', [taskId, farmId]);
    if (taskRes.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }

    const result = await pool.query(
      `INSERT INTO task_updates (task_id, farmer_id, notes, image_url) VALUES ($1, $2, $3, $4) RETURNING *`,
      [taskId, userId, notes || null, imageUrl]
    );

    // Optionally notify manager about the update
    const managerQuery = `
      SELECT u.email, u.id, t.title as task_title, f.full_name as farmer_name
      FROM tasks t
      JOIN app_users u ON t.created_by_user_id = u.id
      JOIN app_users f ON $2 = f.id
      WHERE t.id = $1
    `;
    const managerRes = await pool.query(managerQuery, [taskId, userId]);
    
    if (managerRes.rows.length > 0) {
      const manager = managerRes.rows[0];
      const updateDetails = {
        farmerName: manager.farmer_name,
        taskTitle: manager.task_title,
        timestamp: new Date().toISOString(),
        notes: notes,
        hasImage: !!imageUrl
      };
      
      // Send Email
      await sendTaskUpdateEmail(manager.email, updateDetails);

      // Add db notification
      await pool.query(`
        INSERT INTO notifications (user_id, farm_id, type, title, message, priority)
        VALUES ($1, $2, 'TASK_UPDATE', 'Farmer Task Update', $3, 'normal')
      `, [manager.id, farmId, `${manager.farmer_name} submitted an update for task "${manager.task_title}".`]);
    }

    res.status(201).json({ message: 'Task update saved', update: result.rows[0] });
  } catch (err) {
    console.error('Error creating task update:', err);
    res.status(500).json({ error: 'Failed to save task update' });
  }
}

export async function getRecentTaskUpdates(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const query = `
      SELECT tu.id, tu.notes, tu.image_url, tu.created_at, t.title as task_title, u.full_name as farmer_name
      FROM task_updates tu
      JOIN tasks t ON tu.task_id = t.id
      JOIN app_users u ON tu.farmer_id = u.id
      WHERE t.farm_id = $1
      ORDER BY tu.created_at DESC
      LIMIT 10
    `;
    const result = await pool.query(query, [farmId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent task updates:', err);
    res.status(500).json({ error: 'Failed to fetch task updates' });
  }
}
