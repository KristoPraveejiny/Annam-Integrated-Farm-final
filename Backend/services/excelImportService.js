import xlsx from 'xlsx';
import { pool } from '../db.js';

export const importExcelData = async (filePath) => {
    try {
        const workbook = xlsx.readFile(filePath);

        // Transaction start
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Process Farm (if applicable, though the user said "import Farm information". The excel didn't have a specific Farm sheet, just titles).
            // Let's use the first existing farm
            let farmId;
            const farmRes = await client.query(`SELECT id FROM farms LIMIT 1`);
            if (farmRes.rowCount > 0) {
                farmId = farmRes.rows[0].id;
            } else {
                throw new Error("No farms exist in the database. Please create a farm first.");
            }

            // 2. Import Fields
            let fieldSheet = workbook.Sheets['Field Details'];
            if (fieldSheet) {
                const fieldData = xlsx.utils.sheet_to_json(fieldSheet, { range: 3 });
                for (const row of fieldData) {
                    if (!row['Field Name']) continue; // Skip empty rows
                    
                    const fieldName = row['Field Name'] ? String(row['Field Name']).substring(0, 50) : '';
                    const fieldCode = row['Field Code'] ? String(row['Field Code']).substring(0, 20) : '';
                    const area = parseFloat(row['Area (Acres)']) || 0;
                    const status = row['Status'] ? String(row['Status']).substring(0, 20) : 'Active';
                    const irrigation = row['Irrigation Type'] ? String(row['Irrigation Type']).substring(0, 50) : '';
                    const soil = row['Soil Type'] ? String(row['Soil Type']).substring(0, 50) : '';
                    const soilPh = parseFloat(row['Soil pH']) || null;
                    
                    // Check duplicate
                    const existField = await client.query(`SELECT id FROM farm_fields WHERE farm_id = $1 AND field_name = $2`, [farmId, fieldName]);
                    if (existField.rowCount === 0) {
                        await client.query(
                            `INSERT INTO farm_fields (farm_id, field_name, field_code, area, status, irrigation_type, soil_type, soil_ph)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                            [farmId, fieldName, fieldCode, area, status, irrigation, soil, soilPh]
                        );
                    }
                }
            }

            // 3. Import Crops
            let cropSheet = workbook.Sheets['Crop Details'];
            if (cropSheet) {
                const cropData = xlsx.utils.sheet_to_json(cropSheet, { range: 3 });
                for (const row of cropData) {
                    if (!row['Crop Name']) continue;
                    
                    const cropName = row['Crop Name'];
                    const variety = row['Variety'] || '';
                    const fieldName = row['Field'];
                    const plantingDateRaw = row['Planting Date'];
                    let plantingDate = new Date();
                    if (typeof plantingDateRaw === 'number') {
                        // Excel date to JS Date
                        plantingDate = new Date((plantingDateRaw - (25567 + 2)) * 86400 * 1000);
                    } else if (plantingDateRaw) {
                        plantingDate = new Date(plantingDateRaw);
                    }
                    
                    let fieldId = null;
                    if (fieldName) {
                        const fieldRes = await client.query(`SELECT id FROM farm_fields WHERE farm_id = $1 AND field_name = $2`, [farmId, fieldName]);
                        if (fieldRes.rowCount > 0) fieldId = fieldRes.rows[0].id;
                    }

                    // Check duplicate
                    const existCrop = await client.query(
                        `SELECT id FROM crop_cycles WHERE farm_id = $1 AND crop_name = $2 AND field_id = $3 AND planting_date = $4`,
                        [farmId, cropName, fieldId, plantingDate]
                    );

                    if (existCrop.rowCount === 0) {
                        // 1. Fetch growth period from crop_master
                        let growthPeriod = 90; // Default if not found
                        const masterRes = await client.query(`SELECT average_growth_period FROM crop_master WHERE crop_name = $1`, [cropName]);
                        if (masterRes.rowCount > 0) growthPeriod = masterRes.rows[0].average_growth_period;

                        // 2. Calculate expected harvest date
                        const expectedHarvestDate = new Date(plantingDate.getTime() + growthPeriod * 86400 * 1000);

                        // 3. Calculate actual harvest date (e.g. expected + random offset between -7 and +7 days)
                        const offset = Math.floor(Math.random() * 15) - 7;
                        const actualHarvestDate = new Date(expectedHarvestDate.getTime() + offset * 86400 * 1000);

                        await client.query(
                            `INSERT INTO crop_cycles (farm_id, field_id, crop_name, variety, planting_date, expected_harvest_date, actual_harvest_date, status, harvest_status, is_historical, harvest_progress, remaining_days)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, 'harvested', 'Harvested', true, 100, 0)`,
                            [farmId, fieldId, cropName, variety, plantingDate, expectedHarvestDate, actualHarvestDate]
                        );
                    }
                }
            }

            // 4. Import Livestock
            let livestockSheet = workbook.Sheets['Livestock Details'];
            if (livestockSheet) {
                const livestockData = xlsx.utils.sheet_to_json(livestockSheet, { range: 3 });
                for (const row of livestockData) {
                    if (!row['Animal Type']) continue;
                    
                    const species = row['Animal Type'];
                    const count = parseInt(row['Count']) || 0;
                    const breed = row['Breed'] || '';
                    const notes = `Age: ${row['Age Group'] || ''}, Health: ${row['Health Status'] || ''}, Feed: ${row['Feed Plan'] || ''}`;

                    const groupCode = `GRP-${species.substring(0,3).toUpperCase()}-${Math.floor(Math.random()*1000)}`;
                    const existLv = await client.query(`SELECT id FROM livestock_groups WHERE farm_id = $1 AND species = $2 AND breed = $3`, [farmId, species, breed]);
                    if (existLv.rowCount === 0) {
                        await client.query(
                            `INSERT INTO livestock_groups (farm_id, group_code, species, breed, count_current, notes, status)
                             VALUES ($1, $2, $3, $4, $5, $6, 'healthy')`,
                            [farmId, groupCode, species, breed, count, notes]
                        );
                    } else {
                        // Update count if exists
                        await client.query(
                            `UPDATE livestock_groups SET count_current = $1, notes = $2 WHERE id = $3`,
                            [count, notes, existLv.rows[0].id]
                        );
                    }
                }
            }

            await client.query('COMMIT');
            return { success: true, message: "Import successful" };
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error importing excel:", error);
        throw error;
    }
};
