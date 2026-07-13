import express from 'express';
import { verifyToken } from '../authMiddleware.js';
import { authorizeRole } from '../authMiddleware.js';
import { 
  createTask, 
  getFarmerTasks, 
  getFarmManagerTasks, 
  updateTaskDetails, 
  startTask, 
  submitTaskEvidence, 
  reviewTask,
  getWorkers,
  getRecentTaskUpdates
} from '../controllers/taskController.js';
import upload from '../uploadMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/workers', getWorkers);
router.post('/', createTask);
router.get('/farmer', getFarmerTasks);
router.get('/manager', getFarmManagerTasks);
router.get('/updates/recent', getRecentTaskUpdates);

router.put('/:id', updateTaskDetails);

// New workflow routes
router.put('/:id/start', startTask);
router.post('/:id/evidence', upload.single('image'), submitTaskEvidence);
router.put('/:id/review', authorizeRole(['farm_manager', 'super_admin']), reviewTask);

export default router;
