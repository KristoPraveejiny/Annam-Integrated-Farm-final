import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import { 
  generateMonthlyPayroll,
  getPayroll,
  getMyEarnings,
  getSalaryAdvances,
  requestSalaryAdvance,
  reviewSalaryAdvance,
  approvePayrollRecord,
  processSalaryPayment,
  paySalaryAdvance,
  getSalaryReport,
  getPayoutConfig,
} from '../controllers/salaryController.js';

const router = express.Router();

router.use(verifyToken);

router.post('/generate', authorizeRole(['farm_manager', 'super_admin']), generateMonthlyPayroll);
router.get('/', authorizeRole(['farm_manager', 'super_admin', 'worker', 'farmer']), getPayroll);
router.get('/report', authorizeRole(['farm_manager', 'super_admin']), getSalaryReport);
router.get('/payout-config', authorizeRole(['farm_manager', 'super_admin']), getPayoutConfig);
router.get('/my-earnings', authorizeRole(['worker', 'farmer', 'farm_manager', 'super_admin']), getMyEarnings);
router.get('/advances', authorizeRole(['farm_manager', 'super_admin', 'worker', 'farmer']), getSalaryAdvances);
router.post('/advances/request', authorizeRole(['worker', 'farmer']), requestSalaryAdvance);
router.put('/advances/:id/review', authorizeRole(['farm_manager', 'super_admin']), reviewSalaryAdvance);
router.post('/advances/:id/pay', authorizeRole(['farm_manager', 'super_admin']), paySalaryAdvance);
router.put('/:id/approve', authorizeRole(['farm_manager', 'super_admin']), approvePayrollRecord);
router.put('/:id/process', authorizeRole(['farm_manager', 'super_admin']), processSalaryPayment);
router.post('/pay/:workerId', authorizeRole(['farm_manager', 'super_admin']), processSalaryPayment);

export default router;
