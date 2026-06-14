import express from 'express';
import { verifyToken } from '../authMiddleware.js';
import { createTask, getFarmerTasks, getFarmManagerTasks, updateTaskStatus, getWorkers } from '../controllers/taskController.js';

const router = express.Router();

router.use(verifyToken);

router.get('/workers', getWorkers);
router.post('/', createTask);
router.get('/farmer', getFarmerTasks);
router.get('/manager', getFarmManagerTasks);
import upload from '../uploadMiddleware.js';
import { createTaskUpdate, getRecentTaskUpdates } from '../controllers/taskController.js';

router.get('/updates/recent', getRecentTaskUpdates);

router.put('/:id/status', updateTaskStatus);
router.post('/:id/updates', upload.single('image'), createTaskUpdate);

export default router;
