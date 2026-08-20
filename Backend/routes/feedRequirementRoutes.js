import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import { deleteFeedRequirement, getFeedRequirements, upsertFeedRequirement, getFeedWeatherAdvice } from '../controllers/feedRequirementController.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', authorizeRole(['farm_manager', 'super_admin', 'worker', 'farmer']), getFeedRequirements);
// Weather-driven feed/water adjustments for today.
router.get('/weather-advice', authorizeRole(['farm_manager', 'super_admin', 'worker', 'farmer']), getFeedWeatherAdvice);

router.post('/', authorizeRole(['farm_manager']), upsertFeedRequirement);
router.put('/:id', authorizeRole(['farm_manager']), upsertFeedRequirement);
router.delete('/:id', authorizeRole(['farm_manager']), deleteFeedRequirement);

export default router;
