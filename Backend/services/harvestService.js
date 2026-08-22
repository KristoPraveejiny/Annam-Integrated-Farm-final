import { pool } from '../db.js';

const DAY_MS = 86400 * 1000;

// pg returns DATE columns as local-midnight Date objects; comparing them
// directly drifts by the timezone offset, so day maths is done on UTC midnights.
const toUtcDay = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
};

/**
 * Perennials (coconut, mango, lemon, papaya) survive every harvest and keep
 * bearing for years, so there is no single harvest date and no terminal
 * "harvested" state. Progress counts down to the NEXT pick instead, measured
 * from the last recorded harvest.
 */
const calculatePerennial = async (crop, master) => {
    const plantingDay = toUtcDay(crop.planting_date);
    const today = toUtcDay(new Date());

    const firstHarvestDays = master.first_harvest_duration || master.average_growth_period;
    const frequency = master.harvest_frequency || 365;

    const lastHarvestRes = await pool.query(
        `SELECT MAX(harvest_date) AS last_harvest FROM crop_harvests WHERE crop_cycle_id = $1`,
        [crop.id]
    );
    const lastHarvestRaw = lastHarvestRes.rows[0]?.last_harvest || null;
    const lastHarvest = lastHarvestRaw ? toUtcDay(lastHarvestRaw) : null;

    // Before the tree has ever borne fruit it is simply maturing towards its
    // first harvest; afterwards every cycle is one harvest interval long.
    const anchor = lastHarvest ?? plantingDay;
    const windowDays = lastHarvest ? frequency : firstHarvestDays;

    const nextHarvestDate = new Date(anchor + windowDays * DAY_MS);
    const elapsedDays = Math.floor((today - anchor) / DAY_MS);

    let remainingDays = windowDays - elapsedDays;
    if (remainingDays < 0) remainingDays = 0;

    let progress = Math.floor((elapsedDays / windowDays) * 100);
    if (progress > 100) progress = 100;
    if (progress < 0) progress = 0;

    const currentStatus = !lastHarvest
        ? 'Maturing'
        : remainingDays === 0 ? 'Harvest Due' : 'Bearing';

    await pool.query(
        `UPDATE crop_cycles
         SET expected_harvest_date = $1, remaining_days = $2, harvest_progress = $3, harvest_status = $4,
             actual_harvest_date = COALESCE($5, actual_harvest_date),
             status = CASE WHEN status = 'planned' AND planting_date <= CURRENT_DATE THEN 'growing' ELSE status END
         WHERE id = $6`,
        [nextHarvestDate, remainingDays, progress, currentStatus, lastHarvestRaw, crop.id]
    );

    // Reminders still fire ahead of the next pick, but a perennial is never
    // "overdue" - the fruit simply keeps ripening.
    if (remainingDays > 0) {
        let trigger = null;
        if (remainingDays === 14) trigger = { priority: 'Normal', title: 'Upcoming Harvest (14 Days)' };
        else if (remainingDays === 7) trigger = { priority: 'High', title: 'Harvest Preparation (7 Days)' };
        else if (remainingDays === 1) trigger = { priority: 'Urgent', title: 'Harvest Tomorrow' };

        if (trigger && crop.remaining_days !== remainingDays) {
            await notifyFarm(
                crop.farm_id,
                'harvest',
                trigger.title,
                `${crop.crop_name} is ready for its next harvest in ${remainingDays} days.`,
                trigger.priority
            );
        }
    }

    return { expectedHarvestDate: nextHarvestDate, remainingDays, progress, currentStatus };
};

// Crops are typed in by hand ("green chilli", " Tomato "), so an exact match on
// crop_master misses rows that clearly refer to the same crop. Match loosely,
// and fall back to a generic season length so every crop still gets an
// expected harvest date and a status instead of a blank cell.
const DEFAULT_GROWTH_PERIOD = 90;

const findCropMaster = async (cropName) => {
    const name = String(cropName || '').trim();
    if (!name) return null;

    const exact = await pool.query(
        `SELECT * FROM crop_master WHERE LOWER(TRIM(crop_name)) = LOWER($1)`,
        [name]
    );
    if (exact.rowCount > 0) return exact.rows[0];

    // "green chilli" -> "Chilli", "paddy rice" -> "Paddy": prefer the longest
    // master name contained in (or containing) what the user typed.
    const fuzzy = await pool.query(
        `SELECT * FROM crop_master
          WHERE LOWER($1) LIKE '%' || LOWER(TRIM(crop_name)) || '%'
             OR LOWER(TRIM(crop_name)) LIKE '%' || LOWER($1) || '%'
          ORDER BY LENGTH(crop_name) DESC
          LIMIT 1`,
        [name]
    );
    if (fuzzy.rowCount > 0) return fuzzy.rows[0];

    return { crop_name: name, average_growth_period: DEFAULT_GROWTH_PERIOD, is_perennial: false, default_status_progression: null };
};

const notifyFarm = async (farmId, type, title, message, priority) => {
    const usersRes = await pool.query(`
        SELECT owner_id as id FROM farms WHERE id = $1
        UNION
        SELECT user_id as id FROM farm_memberships WHERE farm_id = $1
    `, [farmId]);

    for (const u of usersRes.rows) {
        await pool.query(`
            INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
            VALUES ($1, $2, $3, $4, $5, $6, 'in-app')
        `, [u.id, farmId, type, title, message, priority]);
    }
};

export const calculateHarvestForCrop = async (cropId) => {
    try {
        const cropRes = await pool.query(`SELECT * FROM crop_cycles WHERE id = $1`, [cropId]);
        if (cropRes.rowCount === 0) return;
        const crop = cropRes.rows[0];

        const master = await findCropMaster(crop.crop_name);
        if (!master) return;

        if (master.is_perennial) {
            return await calculatePerennial(crop, master);
        }

        const plantingDate = new Date(crop.planting_date);
        const growthPeriod = master.average_growth_period || DEFAULT_GROWTH_PERIOD;
        
        const expectedHarvestDate = new Date(plantingDate.getTime() + growthPeriod * 86400 * 1000);
        const now = new Date();
        
        const totalDays = growthPeriod;
        const elapsedDays = Math.floor((now - plantingDate) / (86400 * 1000));
        let remainingDays = totalDays - elapsedDays;
        if (remainingDays < 0) remainingDays = 0;
        
        let progress = Math.floor((elapsedDays / totalDays) * 100);
        if (progress > 100) progress = 100;
        if (progress < 0) progress = 0;

        // Determine status based on default_status_progression
        let currentStatus = 'Recently Planted';
        if (master.default_status_progression) {
            const progression = master.default_status_progression;
            for (const stage of progression) {
                if (elapsedDays >= stage.days_offset * totalDays) {
                    currentStatus = stage.stage;
                }
            }
        }
        
        if (elapsedDays > totalDays) {
            currentStatus = 'Overdue';
        }

        await pool.query(
            `UPDATE crop_cycles
             SET expected_harvest_date = $1, remaining_days = $2, harvest_progress = $3, harvest_status = $4,
                 -- a crop only stays "planned" until its planting date arrives
                 status = CASE WHEN status = 'planned' AND planting_date <= CURRENT_DATE THEN 'growing' ELSE status END
             WHERE id = $5`,
            [expectedHarvestDate, remainingDays, progress, currentStatus, cropId]
        );
        
        // Notifications
        if (elapsedDays <= totalDays) {
            let notificationTrigger = null;
            if (remainingDays === 14) notificationTrigger = { days: 14, priority: 'Normal', title: 'Upcoming Harvest (14 Days)' };
            else if (remainingDays === 7) notificationTrigger = { days: 7, priority: 'High', title: 'Harvest Preparation (7 Days)' };
            else if (remainingDays === 1) notificationTrigger = { days: 1, priority: 'Urgent', title: 'Harvest Tomorrow' };
            else if (remainingDays === 0) notificationTrigger = { days: 0, priority: 'Urgent', title: 'Harvest Due Today' };
            
            if (notificationTrigger && crop.remaining_days !== remainingDays) {
                // Ensure we don't spam notifications if remaining_days hasn't changed from the last run (e.g. multiple runs a day)
                const message = `${crop.crop_name} in your farm is expected to be harvested in ${remainingDays} days.`;
                const usersRes = await pool.query(`
                    SELECT owner_id as id FROM farms WHERE id = $1
                    UNION
                    SELECT user_id as id FROM farm_memberships WHERE farm_id = $1
                `, [crop.farm_id]);
                
                for (const u of usersRes.rows) {
                    await pool.query(`
                        INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
                        VALUES ($1, $2, 'harvest', $3, $4, $5, 'in-app')
                    `, [u.id, crop.farm_id, notificationTrigger.title, message, notificationTrigger.priority]);
                }
            }
        } else if (remainingDays === 0 && crop.status !== 'harvested' && crop.status !== 'completed' && crop.harvest_status === 'Overdue' && crop.remaining_days !== 0) {
            // Overdue notification
            const message = `${crop.crop_name} is overdue for harvest! Please update its status.`;
            const usersRes = await pool.query(`
                SELECT owner_id as id FROM farms WHERE id = $1
                UNION
                SELECT user_id as id FROM farm_memberships WHERE farm_id = $1
            `, [crop.farm_id]);
            
            for (const u of usersRes.rows) {
                await pool.query(`
                    INSERT INTO notifications (user_id, farm_id, type, title, message, priority, channel)
                    VALUES ($1, $2, 'harvest_overdue', 'Harvest Overdue', $3, 'Urgent', 'in-app')
                `, [u.id, crop.farm_id, message]);
            }
        }
        
        return { expectedHarvestDate, remainingDays, progress, currentStatus };
    } catch (error) {
        console.error("Error calculating harvest:", error);
    }
};

export const updateAllHarvests = async () => {
    try {
        // Perennials are always recalculated - they never reach a terminal
        // "harvested" state, so a stray flag must not freeze their countdown.
        const crops = await pool.query(`
            SELECT c.id
            FROM crop_cycles c
            LEFT JOIN crop_master m ON m.crop_name = c.crop_name
            WHERE COALESCE(m.is_perennial, FALSE) = TRUE
               OR (
                    (c.harvest_status IS NULL OR c.harvest_status != 'Harvested')
                    AND c.is_historical = FALSE
                    AND c.status != 'harvested'
                  )
        `);
        for (const crop of crops.rows) {
            await calculateHarvestForCrop(crop.id);
        }
        console.log(`Updated harvest stats for ${crops.rowCount} crops.`);
    } catch (e) {
        console.error(e);
    }
};
