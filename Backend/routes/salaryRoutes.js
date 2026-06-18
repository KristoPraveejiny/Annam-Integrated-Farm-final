import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import { 
  getPendingAttendances, 
  approveAttendance, 
  getMonthlySalarySummary,
  submitMonthlyPayment,
  getMyEarnings 
} from '../controllers/salaryController.js';

const router = express.Router();

// Manager Routes
router.get('/pending', verifyToken, authorizeRole(['farm_manager', 'super_admin']), getPendingAttendances);
router.put('/approve/:id', verifyToken, authorizeRole(['farm_manager', 'super_admin']), approveAttendance);
router.get('/report', verifyToken, authorizeRole(['farm_manager', 'super_admin']), getMonthlySalarySummary);
router.post('/pay/:worker_id', verifyToken, authorizeRole(['farm_manager', 'super_admin']), submitMonthlyPayment);

// Worker Routes
router.get('/my-earnings', verifyToken, authorizeRole(['worker', 'farmer', 'farm_manager']), getMyEarnings);

export default router;
