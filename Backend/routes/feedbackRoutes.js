import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import {
  submitFeedback,
  getMyFeedback,
  getPublicVisibleFeedback,
  getAdminFeedback,
  updateFeedbackStatus,
  deleteFeedback,
} from '../controllers/feedbackController.js';

const router = express.Router();

router.get('/public', getPublicVisibleFeedback);
router.post('/', verifyToken, authorizeRole(['customer', 'worker']), submitFeedback);
router.get('/my-feedback', verifyToken, authorizeRole(['customer', 'worker']), getMyFeedback);
router.get('/admin/feedback', verifyToken, authorizeRole(['super_admin', 'farm_manager']), getAdminFeedback);
router.put('/admin/feedback/:id/status', verifyToken, authorizeRole(['super_admin']), updateFeedbackStatus);
router.delete('/admin/feedback/:id', verifyToken, authorizeRole(['super_admin']), deleteFeedback);

export default router;
