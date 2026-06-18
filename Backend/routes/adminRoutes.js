import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import { 
  getDashboardOverview, 
  getUsers, 
  updateUserStatus,
  getAdminFarms,
  getAdminFarmManagers,
  getAdminFarmers,
  getAdminCrops,
  getAdminLivestock,
  getAdminAIAdvisories,
  getAdminTasks,
  getAdminSalaries
} from '../controllers/adminController.js';

const router = express.Router();

// Apply middleware to all routes in this file
router.use(verifyToken);
router.use(authorizeRole(['super_admin']));

// Dashboard overview stats
router.get('/dashboard-overview', getDashboardOverview);

// User management
router.get('/users', getUsers);
router.patch('/users/:id/status', updateUserStatus);

// System-wide Monitoring Routes
router.get('/farms', getAdminFarms);
router.get('/farm-managers', getAdminFarmManagers);
router.get('/farmers', getAdminFarmers);
router.get('/crops', getAdminCrops);
router.get('/livestock', getAdminLivestock);
router.get('/ai-advisories', getAdminAIAdvisories);
router.get('/tasks', getAdminTasks);
router.get('/salaries', getAdminSalaries);

export default router;
