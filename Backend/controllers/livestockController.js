import { pool } from '../db.js';

// Helper function to get or create a default farm for the user
async function getDefaultFarmId(userId) {
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
        a.id, a.tag_code as "tagCode", a.species, a.breed, 
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
    if (!tagCode || !species) {
      return res.status(400).json({ error: 'tagCode and species are required' });
    }

      // Validate groupId existence (UUID)
      let validGroupId = null;
      if (groupId) {
        // Directly use the provided groupId as UUID string
        const groupCheck = await pool.query('SELECT id FROM livestock_groups WHERE id = $1', [groupId]);
        if (groupCheck.rowCount > 0) {
          validGroupId = groupId;
        } else {
          console.warn('Provided groupId does not exist, setting to null');
        }
      }


    const result = await pool.query(`
      INSERT INTO livestock_animals 
      (farm_id, group_id, tag_code, species, breed, birth_date, health_status, sex, current_weight_kg, acquisition_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      farmId,
      validGroupId,
      tagCode,
      species,
      breed,
      dob || null,
      healthStatus ? healthStatus.toLowerCase() : 'healthy',
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
    res.status(500).json({ error: 'Failed to add livestock' });
  }
}
