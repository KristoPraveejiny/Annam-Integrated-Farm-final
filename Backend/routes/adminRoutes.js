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
  getAdminDiseaseDetections,
  getAdminTasks,
  getAdminSalaries,
  getSystemSettings,
  updateSystemSetting,
  getAdminNotifications,
  uploadSystemSettingImages
} from '../controllers/adminController.js';
import upload from '../systemSettingUploadMiddleware.js';

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
router.get('/disease-detections', getAdminDiseaseDetections);
router.get('/tasks', getAdminTasks);
router.get('/salaries', getAdminSalaries);
router.get('/system-settings', getSystemSettings);
router.post('/system-settings/upload', upload.any(), uploadSystemSettingImages);
router.put('/system-settings', updateSystemSetting);
router.get('/notifications', getAdminNotifications);

export default router;
