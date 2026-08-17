import { pool } from '../db.js';

export const calculateHarvestForCrop = async (cropId) => {
    try {
        const cropRes = await pool.query(`SELECT * FROM crop_cycles WHERE id = $1`, [cropId]);
        if (cropRes.rowCount === 0) return;
        const crop = cropRes.rows[0];

        const masterRes = await pool.query(`SELECT * FROM crop_master WHERE crop_name = $1`, [crop.crop_name]);
        if (masterRes.rowCount === 0) return; // No master data, can't calculate
        const master = masterRes.rows[0];

        const plantingDate = new Date(crop.planting_date);
        const growthPeriod = master.average_growth_period;
        
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
             SET expected_harvest_date = $1, remaining_days = $2, harvest_progress = $3, harvest_status = $4 
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
        const crops = await pool.query(`SELECT id FROM crop_cycles WHERE (harvest_status IS NULL OR harvest_status != 'Harvested') AND is_historical = FALSE AND status != 'harvested' AND status != 'completed'`);
        for (const crop of crops.rows) {
            await calculateHarvestForCrop(crop.id);
        }
        console.log(`Updated harvest stats for ${crops.rowCount} crops.`);
    } catch (e) {
        console.error(e);
    }
};
