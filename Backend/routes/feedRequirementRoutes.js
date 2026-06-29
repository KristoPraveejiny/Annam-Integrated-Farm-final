import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import { deleteFeedRequirement, getFeedRequirements, upsertFeedRequirement } from '../controllers/feedRequirementController.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getFeedRequirements);
router.post('/', authorizeRole(['farm_manager']), upsertFeedRequirement);
router.put('/:id', authorizeRole(['farm_manager']), upsertFeedRequirement);
router.delete('/:id', authorizeRole(['farm_manager']), deleteFeedRequirement);

export default router;
