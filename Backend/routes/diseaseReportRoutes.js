import express from 'express';
import { 
  createReport, 
  getReports, 
  getReportById, 
  updateReportStatus, 
  saveAIResult,
  checkDuplicates,
  rewardWorker
} from '../controllers/diseaseReportController.js';
import { verifyToken } from '../authMiddleware.js';
import upload from '../uploadMiddleware.js';

const router = express.Router();

router.post('/', verifyToken, upload.single('image'), createReport);
router.get('/', verifyToken, getReports);
router.get('/check-duplicates', verifyToken, checkDuplicates);
router.get('/:id', verifyToken, getReportById);
router.put('/:id/status', verifyToken, updateReportStatus);
router.put('/:id/ai-result', verifyToken, saveAIResult);
router.post('/reward-worker', verifyToken, rewardWorker);

export default router;
