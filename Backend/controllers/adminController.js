import { pool } from '../db.js';
import { isSettledPayroll, summarisePayrollRow } from '../utils/payrollMath.js';

export const getDashboardOverview = async (req, res) => {
  try {
    // 1. Total Users By Role
    const usersRes = await pool.query(`
      SELECT role, COUNT(*) as count 
      FROM app_users 
      GROUP BY role
    `);
    const users = {
      total: 0,
      farmers: 0,
      managers: 0,
      customers: 0,
      admins: 0
    };
    usersRes.rows.forEach(row => {
      const c = parseInt(row.count, 10);
      users.total += c;
      if (row.role === 'worker') users.farmers = c;
      else if (row.role === 'farm_manager') users.managers = c;
      else if (row.role === 'customer') users.customers = c;
      else if (row.role === 'super_admin') users.admins = c;
    });

    // 2. Field Statistics
    const fieldsRes = await pool.query(`
      SELECT 
        COUNT(*) as total_fields,
        SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('active', 'open', 'available') THEN 1 ELSE 0 END) as active_fields,
        COALESCE(SUM(COALESCE(area::numeric, 0)), 0) as total_area
      FROM farm_fields
    `);

    let fieldsWithCrops = 0;
    try {
      const cropFieldColumnRes = await pool.query(`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'crop_cycles'
          AND column_name = 'field_id'
        LIMIT 1
      `);

      if (cropFieldColumnRes.rowCount > 0) {
        const fieldsWithCropsRes = await pool.query(`
          SELECT COUNT(DISTINCT field_id) AS count
          FROM crop_cycles
          WHERE field_id IS NOT NULL
        `);
        fieldsWithCrops = parseInt(fieldsWithCropsRes.rows[0].count || 0, 10);
      }
    } catch (fieldCropError) {
      console.warn('Skipping fields-with-crops aggregation:', fieldCropError.message);
    }

    const farms = {
      total: parseInt(fieldsRes.rows[0].total_fields || 0, 10),
      active: parseInt(fieldsRes.rows[0].active_fields || 0, 10),
      total_area: parseFloat(fieldsRes.rows[0].total_area || 0)
    };
    const fields = {
      total: parseInt(fieldsRes.rows[0].total_fields || 0, 10),
      active: parseInt(fieldsRes.rows[0].active_fields || 0, 10),
      with_crops: fieldsWithCrops,
      total_area: parseFloat(fieldsRes.rows[0].total_area || 0),
    };

    // 3. Crop Statistics
    const cropsRes = await pool.query(`
      SELECT 
        COUNT(*) as total_crops,
        SUM(CASE WHEN status IN ('growing', 'seeded') THEN 1 ELSE 0 END) as growing_crops,
        SUM(CASE WHEN status = 'harvesting' THEN 1 ELSE 0 END) as harvest_ready
      FROM crop_cycles
    `);
    const crops = {
      total: parseInt(cropsRes.rows[0].total_crops || 0, 10),
      growing: parseInt(cropsRes.rows[0].growing_crops || 0, 10),
      harvest_ready: parseInt(cropsRes.rows[0].harvest_ready || 0, 10)
    };

    // 4. Livestock Statistics
    const livestockRes = await pool.query(`
      SELECT 
        COUNT(*) as total_animals,
        SUM(CASE WHEN health_status = 'healthy' THEN 1 ELSE 0 END) as healthy,
        SUM(CASE WHEN health_status IN ('watch', 'treatment') THEN 1 ELSE 0 END) as attention
      FROM livestock_animals
    `);
    const livestock = {
      total: parseInt(livestockRes.rows[0].total_animals || 0, 10),
      healthy: parseInt(livestockRes.rows[0].healthy || 0, 10),
      attention: parseInt(livestockRes.rows[0].attention || 0, 10)
    };

    // 5. Task Statistics
    const tasksRes = await pool.query(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status IN ('todo', 'in_progress') THEN 1 ELSE 0 END) as pending
      FROM tasks
    `);
    const tasks = {
      total: parseInt(tasksRes.rows[0].total_tasks || 0, 10),
      completed: parseInt(tasksRes.rows[0].completed || 0, 10),
      pending: parseInt(tasksRes.rows[0].pending || 0, 10)
    };

    // 6. AI Statistics
    const aiRes = await pool.query(`
      SELECT advisory_kind as type, COUNT(*) as count
      FROM ai_advisories
      GROUP BY advisory_kind
    `);
    const ai = { total: 0, disease: 0, advisory: 0 };
    aiRes.rows.forEach(row => {
      const c = parseInt(row.count, 10);
      ai.total += c;
      if (row.type === 'disease') ai.disease += c;
      else ai.advisory += c;
    });

    res.json({
      users,
      farms,
      fields,
      crops,
      livestock,
      tasks,
      ai
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics.' });
  }
};

export const getUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, full_name, email, phone, role, status, created_at
      FROM app_users
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // update status
    const result = await pool.query(
      'UPDATE app_users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
};

export const getAdminFarms = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, u.full_name as owner_name, u.email as owner_email 
      FROM farms f 
      LEFT JOIN app_users u ON f.owner_user_id = u.id 
      ORDER BY f.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin farms:', error);
    res.status(500).json({ error: 'Failed to fetch farms.' });
  }
};

export const getAdminFarmManagers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at, f.name as farm_name, f.farm_code 
      FROM app_users u 
      LEFT JOIN farm_memberships fm ON u.id = fm.user_id 
      LEFT JOIN farms f ON fm.farm_id = f.id 
      WHERE u.role = 'farm_manager' 
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin farm managers:', error);
    res.status(500).json({ error: 'Failed to fetch farm managers.' });
  }
};

export const getAdminFarmers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at, f.name as farm_name, f.farm_code,
        (SELECT json_agg(json_build_object('id', t.id, 'title', t.title, 'status', t.status, 'due_date', t.due_date)) FROM tasks t WHERE t.assigned_to_user_id = u.id) as recent_tasks,
        (SELECT json_agg(json_build_object('date', a.attendance_date, 'status', a.status)) FROM attendance_records a WHERE a.user_id = u.id) as recent_attendance
      FROM app_users u 
      LEFT JOIN farm_memberships fm ON u.id = fm.user_id 
      LEFT JOIN farms f ON fm.farm_id = f.id 
      WHERE u.role = 'worker' 
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin farmers:', error);
    res.status(500).json({ error: 'Failed to fetch farmers.' });
  }
};

export const getAdminCrops = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, f.name as farm_name, fb.name as block_name 
      FROM crop_cycles c 
      LEFT JOIN farms f ON c.farm_id = f.id 
      LEFT JOIN farm_blocks fb ON c.block_id = fb.id 
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin crops:', error);
    res.status(500).json({ error: 'Failed to fetch crops.' });
  }
};

export const getAdminLivestock = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, f.name as farm_name, lg.group_code 
      FROM livestock_animals l 
      LEFT JOIN farms f ON l.farm_id = f.id 
      LEFT JOIN livestock_groups lg ON l.group_id = lg.id 
      ORDER BY l.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin livestock:', error);
    res.status(500).json({ error: 'Failed to fetch livestock.' });
  }
};

export const getAdminAIAdvisories = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, f.name as farm_name 
      FROM ai_advisories a 
      LEFT JOIN farms f ON a.farm_id = f.id 
      ORDER BY a.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin AI advisories:', error);
    res.status(500).json({ error: 'Failed to fetch AI advisories.' });
  }
};

export const getAdminDiseaseDetections = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, f.name as farm_name 
      FROM disease_detection_history d 
      LEFT JOIN farms f ON d.farm_id = f.id 
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin disease detections:', error);
    res.status(500).json({ error: 'Failed to fetch disease detections.' });
  }
};

export const getAdminTasks = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*,
        u.full_name as assigned_to_name,
        c.full_name as created_by_name,
        -- progress_percent is the legacy DDL column that the workflow never writes;
        -- the live values live in completion_percentage / approved_progress.
        COALESCE(
          NULLIF(t.completion_percentage, 0),
          NULLIF(t.approved_progress, 0),
          t.progress_percent,
          0
        ) AS progress_percent,
        ff.field_name,
        ff.field_code,
        cc.crop_name,
        lg.species AS livestock_species,
        lg.group_code AS livestock_group_code
      FROM tasks t
      LEFT JOIN app_users u ON t.assigned_to_user_id = u.id
      LEFT JOIN app_users c ON t.created_by_user_id = c.id
      LEFT JOIN crop_cycles cc ON cc.id = t.crop_cycle_id
      LEFT JOIN farm_fields ff ON ff.id = COALESCE(t.field_id, cc.field_id)
      LEFT JOIN livestock_groups lg ON lg.id = t.livestock_group_id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
};

export const getAdminSalaries = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
        u.full_name as worker_name,
        COALESCE((
          SELECT SUM(sl.amount)
          FROM salary_ledger sl
          WHERE sl.farm_id = s.farm_id
            AND sl.worker_id = s.worker_id
            AND sl.created_at >= (s.payment_month || '-01')::date
            AND sl.created_at < ((s.payment_month || '-01')::date + INTERVAL '1 month')
        ), 0)::numeric AS ledger_earnings
      FROM monthly_salary_payments s
      LEFT JOIN app_users u ON s.worker_id = u.id
      ORDER BY u.full_name, s.payment_month DESC
    `);

    // Settled rows keep their recorded history; everything else is restated from the
    // ledger so this matches the manager and worker dashboards.
    const rows = result.rows.map((row) => ({
      ...row,
      ...summarisePayrollRow(row, isSettledPayroll(row) ? 0 : row.ledger_earnings),
    }));

    res.json(rows);
  } catch (error) {
    console.error('Error fetching admin salaries:', error);
    res.status(500).json({ error: 'Failed to fetch salaries.' });
  }
};

export const getSystemSettings = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT setting_key, setting_value, scope, description, updated_at
      FROM system_settings
      WHERE scope = 'global'
         OR scope = 'home'
         OR scope = 'about'
      ORDER BY setting_key ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ error: 'Failed to fetch system settings.' });
  }
};

export const updateSystemSetting = async (req, res) => {
  try {
    const { setting_key, setting_value, scope = 'global', description = null } = req.body;
    if (!setting_key || setting_value === undefined) {
      return res.status(400).json({ error: 'setting_key and setting_value are required.' });
    }

    const result = await pool.query(`
      INSERT INTO system_settings (setting_key, setting_value, scope, description, updated_by_user_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (setting_key, scope)
      DO UPDATE SET setting_value = EXCLUDED.setting_value,
                    description = EXCLUDED.description,
                    updated_by_user_id = EXCLUDED.updated_by_user_id,
                    updated_at = now()
      RETURNING setting_key, setting_value, scope, description, updated_at
    `, [setting_key, JSON.stringify(setting_value), scope, description, req.user.userId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating system setting:', error);
    res.status(500).json({ error: 'Failed to update system setting.' });
  }
};

export const uploadSystemSettingImages = async (req, res) => {
  try {
    const files = req.files || [];
    const grouped = files.reduce((acc, file) => {
      if (!acc[file.fieldname]) acc[file.fieldname] = [];
      acc[file.fieldname].push(`/uploads/system-settings/${file.filename}`);
      return acc;
    }, {});

    res.json({ files: grouped });
  } catch (error) {
    console.error('Error uploading system setting images:', error);
    res.status(500).json({ error: 'Failed to upload images.' });
  }
};

export const getAdminNotifications = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.*, u.full_name as user_name, f.name as farm_name
      FROM notifications n
      LEFT JOIN app_users u ON n.user_id = u.id
      LEFT JOIN farms f ON n.farm_id = f.id
      ORDER BY n.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
};
