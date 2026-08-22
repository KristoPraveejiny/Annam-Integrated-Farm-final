import express from 'express';
import {
  createLeaveRequest,
  getMyLeaveRequests,
  getFarmLeaveRequests,
  updateLeaveStatus,
  cancelLeaveRequest,
  getWorkerLeaveDates
} from '../controllers/leaveController.js';
import { verifyToken, authorizeRole } from '../authMiddleware.js';

const router = express.Router();

router.post('/', verifyToken, createLeaveRequest);
router.get('/mine', verifyToken, getMyLeaveRequests);
router.delete('/:id', verifyToken, cancelLeaveRequest);

// Manager-side review and the lookup that drives date blocking.
router.get('/', verifyToken, authorizeRole(['farm_manager', 'super_admin']), getFarmLeaveRequests);
router.put('/:id/status', verifyToken, authorizeRole(['farm_manager', 'super_admin']), updateLeaveStatus);
router.get('/worker/:workerId/dates', verifyToken, authorizeRole(['farm_manager', 'super_admin']), getWorkerLeaveDates);

export default router;
