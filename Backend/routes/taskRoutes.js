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
  getRecentTaskUpdates,
  addActivityUpdate,
  getTaskReviews,
  getTaskTimeline,
  reviewTaskUpdate,
  getTaskEvidence,
  getWorkerVerificationHistory,
  getEvidenceVersions
} from '../controllers/taskController.js';
import upload from '../uploadMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/workers', getWorkers);
router.post('/', createTask);
router.get('/farmer', getFarmerTasks);
router.get('/manager', getFarmManagerTasks);
router.get('/updates/recent', getRecentTaskUpdates);
router.get('/:id/reviews', getTaskReviews);

router.put('/:id', updateTaskDetails);

// New workflow routes
router.put('/:id/start', startTask);
router.post('/:id/activity-update', upload.array('images', 5), addActivityUpdate);
router.post('/:id/evidence', upload.array('images', 5), submitTaskEvidence);
router.get('/:id/evidence', getTaskEvidence);
router.get('/:id/timeline', getTaskTimeline);
router.get('/worker-history/:workerId', authorizeRole(['farm_manager', 'super_admin']), getWorkerVerificationHistory);
router.get('/:id/evidence-versions', authorizeRole(['farm_manager', 'super_admin']), getEvidenceVersions);
router.put('/:id/review', authorizeRole(['farm_manager', 'super_admin']), reviewTask);
router.put('/update/:updateId/review', authorizeRole(['farm_manager', 'super_admin']), reviewTaskUpdate);

export default router;
