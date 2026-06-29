import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import { createFeedSchedule, getFeedSchedules, updateFeedScheduleStatus } from '../controllers/feedScheduleController.js';

const router = express.Router();

router.use(verifyToken);
router.get('/', authorizeRole(['farm_manager']), getFeedSchedules);
router.post('/', authorizeRole(['farm_manager']), createFeedSchedule);
router.put('/:id/status', authorizeRole(['farm_manager']), updateFeedScheduleStatus);

export default router;
