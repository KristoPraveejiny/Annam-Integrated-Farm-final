import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import { createFeedSchedule, getFeedSchedules, updateFeedScheduleStatus, getFeedLogs, getFeedSummary, completeFeedSchedule } from '../controllers/feedScheduleController.js';

const router = express.Router();

router.use(verifyToken);
router.get('/', authorizeRole(['farm_manager', 'super_admin', 'worker', 'farmer']), getFeedSchedules);
router.get('/logs', authorizeRole(['farm_manager', 'super_admin']), getFeedLogs);
router.get('/summary', authorizeRole(['farm_manager', 'super_admin', 'worker', 'farmer']), getFeedSummary);
router.post('/', authorizeRole(['farm_manager']), createFeedSchedule);
router.post('/:id/complete', authorizeRole(['worker', 'farmer', 'farm_manager']), completeFeedSchedule);
router.put('/:id/status', authorizeRole(['farm_manager']), updateFeedScheduleStatus);

export default router;
