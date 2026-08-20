import { pool } from '../db.js';
import { calculateHarvestForCrop } from '../services/harvestService.js';

const DAY_MS = 86400 * 1000;

// pg hands back DATE columns as local-midnight Date objects. Comparing those
// directly drifts by the timezone offset, which made re-runs shift every date
// by a day, so all date maths here is done on UTC midnights.
const toUtcDay = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
};

const isoDay = (utcMillis) => new Date(utcMillis).toISOString().slice(0, 10);

/**
 * The Excel importer created one crop_cycle per harvest and marked each one
 * terminal, so a single coconut palm became two dead cycles whose "harvest
 * dates" were fabricated a few days apart. This collapses each perennial back
 * to one living planting and re-spaces its harvests to the real cadence.
 *
 * Quantities, prices and expenses are never touched, so financial totals are
 * unchanged. Safe to re-run.
 */
export async function fixPerennialCycles() {
  const client = await pool.connect();
  const stats = { crops: [], cyclesRemoved: 0, harvestsMoved: 0, harvestsRespaced: 0 };

  try {
    await client.query('BEGIN');

    const perennials = await client.query(
      `SELECT crop_name, harvest_frequency FROM crop_master WHERE is_perennial = TRUE ORDER BY crop_name`
    );

    for (const { crop_name: cropName, harvest_frequency: frequency } of perennials.rows) {
      const cycles = await client.query(`
        SELECT id, farm_id, planting_date, created_at
        FROM crop_cycles
        WHERE crop_name = $1
        ORDER BY planting_date, created_at
      `, [cropName]);

      if (cycles.rowCount === 0) continue;

      // Group duplicate plantings: same crop, same farm, same planting date.
      const groups = new Map();
      for (const cycle of cycles.rows) {
        const key = `${cycle.farm_id}|${new Date(cycle.planting_date).toISOString().slice(0, 10)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(cycle);
      }

      for (const group of groups.values()) {
        const keeper = group[0];
        const duplicates = group.slice(1);

        for (const duplicate of duplicates) {
          const moved = await client.query(
            `UPDATE crop_harvests SET crop_cycle_id = $1 WHERE crop_cycle_id = $2 RETURNING id`,
            [keeper.id, duplicate.id]
          );
          stats.harvestsMoved += moved.rowCount;
          await client.query(`DELETE FROM crop_cycles WHERE id = $1`, [duplicate.id]);
          stats.cyclesRemoved += 1;
        }

        // Re-space: keep the first pick, then step forward one interval at a
        // time so the sequence reflects how the tree actually bears.
        const harvests = await client.query(
          `SELECT id, harvest_date FROM crop_harvests WHERE crop_cycle_id = $1 ORDER BY harvest_date, id`,
          [keeper.id]
        );

        let previous = null;
        for (const harvest of harvests.rows) {
          const current = toUtcDay(harvest.harvest_date);
          if (previous !== null) {
            const gapDays = Math.round((current - previous) / DAY_MS);
            // Only correct picks that are implausibly close together; a
            // correctly spaced history is left exactly as it is.
            if (gapDays < frequency) {
              const corrected = previous + frequency * DAY_MS;
              await client.query(
                `UPDATE crop_harvests SET harvest_date = $1::date, updated_at = now() WHERE id = $2`,
                [isoDay(corrected), harvest.id]
              );
              stats.harvestsRespaced += 1;
              previous = corrected;
              continue;
            }
          }
          previous = current;
        }

        // The planting is alive and bearing, not finished.
        await client.query(`
          UPDATE crop_cycles
          SET status = 'harvesting',
              is_historical = FALSE,
              actual_harvest_date = (SELECT MAX(harvest_date) FROM crop_harvests WHERE crop_cycle_id = $1),
              updated_at = now()
          WHERE id = $1
        `, [keeper.id]);

        stats.crops.push({ crop: cropName, keeper: keeper.id, removed: duplicates.length, harvests: harvests.rowCount });
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Populate the next-harvest countdown outside the transaction.
  for (const entry of stats.crops) {
    await calculateHarvestForCrop(entry.keeper);
  }

  return stats;
}

async function run() {
  try {
    const before = await pool.query(`
      SELECT COUNT(*)::int batches, SUM(quantity)::float8 qty,
             SUM(total_revenue)::float8 revenue, SUM(total_expenses)::float8 expenses
      FROM crop_harvests
    `);

    const stats = await fixPerennialCycles();

    if (stats.cyclesRemoved === 0 && stats.harvestsRespaced === 0) {
      console.log('Perennial cycles already normalised - nothing to change.');
    } else {
      console.log(`Duplicate cycles removed : ${stats.cyclesRemoved}`);
      console.log(`Harvests re-pointed      : ${stats.harvestsMoved}`);
      console.log(`Harvests re-spaced       : ${stats.harvestsRespaced}`);
    }
    stats.crops.forEach((entry) => console.log(`  ${entry.crop}: kept 1 planting, ${entry.harvests} harvests`));

    const after = await pool.query(`
      SELECT COUNT(*)::int batches, SUM(quantity)::float8 qty,
             SUM(total_revenue)::float8 revenue, SUM(total_expenses)::float8 expenses
      FROM crop_harvests
    `);

    console.log('\nFinancials before:', JSON.stringify(before.rows[0]));
    console.log('Financials after :', JSON.stringify(after.rows[0]));
    const unchanged = JSON.stringify(before.rows[0]) === JSON.stringify(after.rows[0]);
    console.log(unchanged ? 'Financial totals unchanged.' : 'WARNING: financial totals changed!');
  } catch (error) {
    console.error('Fix failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('fix_perennial_cycles.js')) {
  run();
}
