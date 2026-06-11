import { pool } from '../db.js';

// Helper function to get or create a default farm for the user
async function getDefaultFarmId(userId) {
  // Get user role
  const userRes = await pool.query('SELECT role FROM app_users WHERE id = $1', [userId]);
  const userRole = userRes.rows[0]?.role;

  if (userRole === 'worker') {
    // 1. Check memberships
    let result = await pool.query('SELECT farm_id FROM farm_memberships WHERE user_id = $1 LIMIT 1', [userId]);
    if (result.rows.length > 0) {
      return result.rows[0].farm_id;
    }
    // 2. Fallback to the first farm owned by a farm_manager in the database
    result = await pool.query(`
      SELECT f.id 
      FROM farms f
      JOIN app_users u ON f.owner_user_id = u.id
      WHERE u.role = 'farm_manager'
      ORDER BY f.created_at ASC 
      LIMIT 1
    `);
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    // 3. Absolute fallback to any farm
    result = await pool.query('SELECT id FROM farms ORDER BY created_at ASC LIMIT 1');
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
  }

  // Check if user owns a farm
  let result = await pool.query('SELECT id FROM farms WHERE owner_user_id = $1 LIMIT 1', [userId]);
  if (result.rows.length > 0) {
    return result.rows[0].id;
  }

  // Create a default farm if none exists
  const farmCode = `FARM-${Date.now().toString().slice(-6)}`;
  result = await pool.query(
    'INSERT INTO farms (owner_user_id, farm_code, name, description) VALUES ($1, $2, $3, $4) RETURNING id',
    [userId, farmCode, 'My Default Farm', 'Automatically created farm']
  );
  return result.rows[0].id;
}

// Helper to ensure default groups exist for a farm
async function ensureDefaultGroups(farmId) {
  const defaultGroups = [
    { code: 'COW', species: 'Cattle' },
    { code: 'HEN', species: 'Poultry' },
    { code: 'DUCK', species: 'Poultry' }
  ];

  for (const group of defaultGroups) {
    await pool.query(`
      INSERT INTO livestock_groups (farm_id, group_code, species)
      VALUES ($1, $2, $3)
      ON CONFLICT (farm_id, group_code) DO NOTHING
    `, [farmId, group.code, group.species]);
  }
}

export async function getLivestockGroups(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    await ensureDefaultGroups(farmId);

    const result = await pool.query(
      'SELECT id, group_code, species FROM livestock_groups WHERE farm_id = $1 ORDER BY created_at ASC',
      [farmId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching livestock groups:', err);
    res.status(500).json({ error: 'Failed to fetch livestock groups' });
  }
}

export async function getLivestock(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const result = await pool.query(`
      SELECT 
        a.id, a.tag_code as "tagCode", g.species, g.breed, 
        a.sex, a.current_weight_kg as "weight", a.acquisition_date as "acquisitionDate", a.notes, a.birth_date as dob, a.health_status as health,
        g.group_code as "groupCode"
      FROM livestock_animals a
      LEFT JOIN livestock_groups g ON a.group_id = g.id
      WHERE a.farm_id = $1
      ORDER BY a.created_at DESC
    `, [farmId]);

    const formattedLivestock = result.rows.map(row => ({
      id: row.tagCode,
      dbId: row.id,
      species: row.species,
      breed: row.breed || 'Unknown',
      pen: row.groupCode || 'Unassigned',
      dob: row.dob ? new Date(row.dob).toISOString().split('T')[0] : 'Unknown',
      health: row.health.charAt(0).toUpperCase() + row.health.slice(1),
      sex: row.sex || 'Unknown',
      weight: row.weight !== null ? row.weight.toString() : 'N/A',
      acquisitionDate: row.acquisitionDate ? new Date(row.acquisitionDate).toISOString().split('T')[0] : 'N/A',
      notes: row.notes || '',
      quantity: '1'
    }));

    res.json(formattedLivestock);
  } catch (err) {
    console.error('Error fetching livestock:', err);
    res.status(500).json({ error: 'Failed to fetch livestock' });
  }
}

export async function addLivestock(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);

    const {
      tagCode,
      groupId,
      species,
      breed,
      dob,
      healthStatus,
      sex,
      weight,
      acquisitionDate,
      notes
    } = req.body;

    console.log('Add livestock request body:', req.body);

    // Required fields validation
    if (!tagCode) {
      return res.status(400).json({ error: 'tagCode is required' });
    }

    let validGroupId = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (groupId && uuidRegex.test(groupId)) {
      const groupCheck = await pool.query('SELECT id FROM livestock_groups WHERE id = $1', [groupId]);
      if (groupCheck.rowCount > 0) {
        validGroupId = groupId;
      } else {
        console.warn('Provided groupId does not exist, setting to null');
      }
    } else if (groupId) {
      console.warn('Provided groupId is not a valid UUID format, setting to null');
    }

    // Determine species: use provided or derive from group
    let finalSpecies = species;
    if (!finalSpecies && validGroupId) {
      try {
        const groupRes = await pool.query('SELECT species FROM livestock_groups WHERE id = $1', [validGroupId]);
        finalSpecies = groupRes.rows[0]?.species || 'Unknown';
      } catch (e) {
        console.warn('Could not fetch species for group', e);
        finalSpecies = 'Unknown';
      }
    }
    if (!finalSpecies) finalSpecies = 'Unknown';
    const result = await pool.query(`
      INSERT INTO livestock_animals 
      (farm_id, group_id, tag_code, birth_date, health_status, sex, current_weight_kg, acquisition_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      farmId,
      validGroupId,
      tagCode,
      dob || null,
      (healthStatus && healthStatus.toLowerCase() === 'sick') ? 'treatment' : (healthStatus ? healthStatus.toLowerCase() : 'healthy'),
      sex || null,
      weight || null,
      acquisitionDate || null,
      notes || null
    ]);

    res.status(201).json({ message: 'Animal added successfully', animal: result.rows[0] });
  } catch (err) {
    console.error('Error adding livestock:', err);
    console.error(err.stack);
    if (err.constraint === 'livestock_animals_tag_unique') {
      return res.status(400).json({ error: 'An animal with this tag code already exists.' });
    }
    res.status(500).json({ error: 'Failed to add livestock', details: err.message, stack: err.stack });
  }
}

export async function updateLivestock(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const animalId = req.params.id;

    // Verify animal belongs to user's farm
    const checkOwnership = await pool.query('SELECT id FROM livestock_animals WHERE id = $1 AND farm_id = $2', [animalId, farmId]);
    if (checkOwnership.rowCount === 0) {
      return res.status(404).json({ error: 'Animal not found' });
    }

    const {
      tagCode,
      groupId,
      dob,
      healthStatus,
      sex,
      weight,
      acquisitionDate,
      notes
    } = req.body;

    if (!tagCode) {
      return res.status(400).json({ error: 'tagCode is required' });
    }

    let validGroupId = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (groupId && uuidRegex.test(groupId)) {
      const groupCheck = await pool.query('SELECT id FROM livestock_groups WHERE id = $1', [groupId]);
      if (groupCheck.rowCount > 0) {
        validGroupId = groupId;
      }
    }

    const result = await pool.query(`
      UPDATE livestock_animals 
      SET 
        group_id = $1, tag_code = $2, birth_date = $3, health_status = $4, 
        sex = $5, current_weight_kg = $6, acquisition_date = $7, notes = $8,
        updated_at = NOW()
      WHERE id = $9 AND farm_id = $10
      RETURNING *
    `, [
      validGroupId,
      tagCode,
      dob || null,
      (healthStatus && healthStatus.toLowerCase() === 'sick') ? 'treatment' : (healthStatus ? healthStatus.toLowerCase() : 'healthy'),
      sex || null,
      weight || null,
      acquisitionDate || null,
      notes || null,
      animalId,
      farmId
    ]);

    res.json({ message: 'Animal updated successfully', animal: result.rows[0] });
  } catch (err) {
    console.error('Error updating livestock:', err);
    if (err.constraint === 'livestock_animals_tag_unique') {
      return res.status(400).json({ error: 'An animal with this tag code already exists.' });
    }
    res.status(500).json({ error: 'Failed to update livestock' });
  }
}

export async function deleteLivestock(req, res) {
  try {
    const userId = req.user.userId;
    const farmId = await getDefaultFarmId(userId);
    const animalId = req.params.id;

    // Verify animal belongs to user's farm
    const result = await pool.query('DELETE FROM livestock_animals WHERE id = $1 AND farm_id = $2 RETURNING id', [animalId, farmId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Animal not found' });
    }

    res.json({ message: 'Animal deleted successfully' });
  } catch (err) {
    console.error('Error deleting livestock:', err);
    res.status(500).json({ error: 'Failed to delete livestock' });
  }
}
