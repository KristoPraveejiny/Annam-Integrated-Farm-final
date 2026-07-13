import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import {
  getMonthlyAttendance,
  getWorkerAttendanceProfile,
  getMyAttendance,
  getManagerAttendance,
} from '../controllers/attendanceController.js';

const router = express.Router();

router.use(verifyToken);

router.get('/monthly', getMonthlyAttendance);
router.get('/my', authorizeRole(['worker', 'farmer', 'farm_manager', 'super_admin']), getMyAttendance);
router.get('/manager', authorizeRole(['farm_manager', 'super_admin']), getManagerAttendance);
router.get('/worker/:workerId', getWorkerAttendanceProfile);

export default router;
