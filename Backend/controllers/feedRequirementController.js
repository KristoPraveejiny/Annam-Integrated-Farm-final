import { pool } from '../db.js';
import { getDefaultFarmId } from './livestockController.js';

async function ensureFeedRequirementsTable() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feed_requirements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      animal_type TEXT NOT NULL,
      breed_or_variety TEXT NOT NULL DEFAULT 'Standard',
      feed_type TEXT NOT NULL,
      daily_feed_amount TEXT NOT NULL,
      daily_water_requirement TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'kg/day',
      updated_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS feed_requirements_farm_animal_breed_unique
    ON feed_requirements (farm_id, LOWER(animal_type), LOWER(breed_or_variety))
  `);
}

ensureFeedRequirementsTable().catch((error) => {
  console.error('Failed to ensure feed_requirements table exists:', error);
});

export async function getFeedRequirements(req, res) {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);
    const result = await pool.query(
      `
        SELECT id, animal_type AS "animalType", breed_or_variety AS "breedOrVariety",
               feed_type AS "feedType", daily_feed_amount AS "dailyFeedAmount",
               daily_water_requirement AS "dailyWaterRequirement", unit, updated_by AS "updatedBy",
               updated_at AS "updatedAt", created_at AS "createdAt",
               CASE
                 WHEN LOWER(animal_type) = 'cow' AND LOWER(breed_or_variety) = 'standard' THEN true
                 WHEN LOWER(animal_type) = 'hen' AND LOWER(breed_or_variety) = 'broiler' THEN true
                 WHEN LOWER(animal_type) = 'hen' AND LOWER(breed_or_variety) = 'layer' THEN true
                 ELSE false
               END AS "isDefault"
        FROM feed_requirements
        WHERE farm_id = $1
        ORDER BY animal_type ASC, breed_or_variety ASC, created_at ASC
      `,
      [farmId],
    );

    if (result.rows.length === 0) {
      const defaults = [
        ['Cow', 'Standard', 'Balanced cattle feed', '40 kg/day', '15 liters/day', 'kg/day'],
        ['Hen', 'Broiler', 'Broiler feed', '35 kg/day', 'Configurable', 'kg/day'],
        ['Hen', 'Layer', 'Layer feed', '30 kg/day', 'Configurable', 'kg/day'],
      ];

      for (const [animalType, breedOrVariety, feedType, dailyFeedAmount, dailyWaterRequirement, unit] of defaults) {
        await pool.query(
          `
            INSERT INTO feed_requirements (
              farm_id, animal_type, breed_or_variety, feed_type,
              daily_feed_amount, daily_water_requirement, unit, updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [farmId, animalType, breedOrVariety, feedType, dailyFeedAmount, dailyWaterRequirement, unit, req.user.userId],
        );
      }

      const seeded = await pool.query(
        `
          SELECT id, animal_type AS "animalType", breed_or_variety AS "breedOrVariety",
                 feed_type AS "feedType", daily_feed_amount AS "dailyFeedAmount",
                 daily_water_requirement AS "dailyWaterRequirement", unit, updated_by AS "updatedBy",
                 updated_at AS "updatedAt", created_at AS "createdAt",
                 CASE
                   WHEN LOWER(animal_type) = 'cow' AND LOWER(breed_or_variety) = 'standard' THEN true
                   WHEN LOWER(animal_type) = 'hen' AND LOWER(breed_or_variety) = 'broiler' THEN true
                   WHEN LOWER(animal_type) = 'hen' AND LOWER(breed_or_variety) = 'layer' THEN true
                   ELSE false
                 END AS "isDefault"
          FROM feed_requirements
          WHERE farm_id = $1
          ORDER BY animal_type ASC, breed_or_variety ASC, created_at ASC
        `,
        [farmId],
      );

      return res.json(seeded.rows);
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch feed requirements:', error);
    res.status(500).json({ error: 'Failed to fetch feed requirements' });
  }
}

export async function upsertFeedRequirement(req, res) {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);
    const { id } = req.params;
    const {
      animalType,
      breedOrVariety,
      feedType,
      dailyFeedAmount,
      dailyWaterRequirement,
      unit,
    } = req.body;

    if (!animalType || !breedOrVariety || !feedType || !dailyFeedAmount || !dailyWaterRequirement || !unit) {
      return res.status(400).json({ error: 'Missing required feed requirement fields' });
    }

    const existingById = id
      ? await pool.query('SELECT id FROM feed_requirements WHERE id = $1 AND farm_id = $2 LIMIT 1', [id, farmId])
      : { rowCount: 0 };

    let savedRow;
    if (existingById.rowCount > 0) {
      const updateResult = await pool.query(
        `
          UPDATE feed_requirements
          SET animal_type = $2,
              breed_or_variety = $3,
              feed_type = $4,
              daily_feed_amount = $5,
              daily_water_requirement = $6,
              unit = $7,
              updated_by = $8,
              updated_at = NOW()
          WHERE id = $1 AND farm_id = $9
          RETURNING id, animal_type, breed_or_variety, feed_type, daily_feed_amount, daily_water_requirement, unit, updated_by, updated_at
        `,
        [id, animalType, breedOrVariety, feedType, dailyFeedAmount, dailyWaterRequirement, unit, req.user.userId, farmId],
      );
      savedRow = updateResult.rows[0];
    } else {
      const normalizedAnimalType = animalType.trim();
      const normalizedBreedOrVariety = breedOrVariety.trim();
      const existingByKey = await pool.query(
        `
          SELECT id
          FROM feed_requirements
          WHERE farm_id = $1
            AND LOWER(animal_type) = LOWER($2)
            AND LOWER(breed_or_variety) = LOWER($3)
          LIMIT 1
        `,
        [farmId, normalizedAnimalType, normalizedBreedOrVariety],
      );

      if (existingByKey.rowCount > 0) {
        const updateResult = await pool.query(
          `
            UPDATE feed_requirements
            SET animal_type = $2,
                breed_or_variety = $3,
                feed_type = $4,
                daily_feed_amount = $5,
                daily_water_requirement = $6,
                unit = $7,
                updated_by = $8,
                updated_at = NOW()
            WHERE id = $1 AND farm_id = $9
            RETURNING id, animal_type, breed_or_variety, feed_type, daily_feed_amount, daily_water_requirement, unit, updated_by, updated_at
          `,
          [existingByKey.rows[0].id, normalizedAnimalType, normalizedBreedOrVariety, feedType, dailyFeedAmount, dailyWaterRequirement, unit, req.user.userId, farmId],
        );
        savedRow = updateResult.rows[0];
      } else {
        const insertResult = await pool.query(
          `
            INSERT INTO feed_requirements (
              farm_id, animal_type, breed_or_variety, feed_type,
              daily_feed_amount, daily_water_requirement, unit, updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, animal_type, breed_or_variety, feed_type, daily_feed_amount, daily_water_requirement, unit, updated_by, updated_at
          `,
          [farmId, normalizedAnimalType, normalizedBreedOrVariety, feedType, dailyFeedAmount, dailyWaterRequirement, unit, req.user.userId],
        );
        savedRow = insertResult.rows[0];
      }
    }

    res.json({
      id: savedRow.id,
      animalType: savedRow.animal_type,
      breedOrVariety: savedRow.breed_or_variety,
      feedType: savedRow.feed_type,
      dailyFeedAmount: savedRow.daily_feed_amount,
      dailyWaterRequirement: savedRow.daily_water_requirement,
      unit: savedRow.unit,
      updatedBy: savedRow.updated_by,
      updatedAt: savedRow.updated_at,
      isDefault:
        (savedRow.animal_type || '').toLowerCase() === 'cow' &&
        (savedRow.breed_or_variety || '').toLowerCase() === 'standard' ||
        ((savedRow.animal_type || '').toLowerCase() === 'hen' && (savedRow.breed_or_variety || '').toLowerCase() === 'broiler') ||
        ((savedRow.animal_type || '').toLowerCase() === 'hen' && (savedRow.breed_or_variety || '').toLowerCase() === 'layer'),
    });
  } catch (error) {
    console.error('Failed to save feed requirement:', error);
    res.status(500).json({ error: 'Failed to save feed requirement' });
  }
}

export async function deleteFeedRequirement(req, res) {
  try {
    const farmId = await getDefaultFarmId(req.user.userId);
    const result = await pool.query(
      'DELETE FROM feed_requirements WHERE id = $1 AND farm_id = $2 RETURNING id',
      [req.params.id, farmId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Feed requirement not found' });
    }

    res.json({ message: 'Feed requirement deleted successfully' });
  } catch (error) {
    console.error('Failed to delete feed requirement:', error);
    res.status(500).json({ error: 'Failed to delete feed requirement' });
  }
}
