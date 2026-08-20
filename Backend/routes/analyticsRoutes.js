import { Router } from 'express';
import {
  getHarvestAnalytics,
  listHarvestExpenses,
  updateHarvestExpenses,
  createHarvestRecord,
  getPerennialCrops,
  getHarvestEvents,
  getLivestockGroups,
  createLivestockProduction,
  getLivestockProduction,
  getProductionRecords,
  getRecentProduce,
} from '../controllers/analyticsController.js';
import { verifyToken } from '../authMiddleware.js';

const router = Router();

router.use(verifyToken);

// Harvest revenue, expenses and price analytics for the user's farm.
router.get('/harvest', getHarvestAnalytics);

// Expense management. Super admins see every farm; managers see their own.
router.get('/expenses', listHarvestExpenses);
router.put('/expenses/:id', updateHarvestExpenses);
router.post('/harvests', createHarvestRecord);

// Crops a farmer can log a harvest against, and the recorded picks
// that feed the farm manager's harvest calendar.
router.get('/perennials', getPerennialCrops);
router.get('/harvest-events', getHarvestEvents);

// Livestock production (milk, eggs, meat...) recorded by farmers.
router.get('/livestock-groups', getLivestockGroups);
router.get('/livestock-production', getLivestockProduction);
router.post('/livestock-production', createLivestockProduction);

// Full production history - crops and livestock - for managers and admins.
router.get('/records', getProductionRecords);

// Recent harvests a farmer can list on the marketplace.
router.get('/recent-produce', getRecentProduce);

export default router;
