import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import { createLivestockHealthEvent, getLivestockHealthEvents } from '../controllers/livestockHealthController.js';
import upload from '../uploadMiddleware.js';

const router = express.Router();

router.use(verifyToken);
router.get('/', authorizeRole(['farm_manager', 'super_admin', 'worker', 'farmer']), getLivestockHealthEvents);
router.post('/', authorizeRole(['farm_manager', 'super_admin', 'worker', 'farmer']), upload.single('image'), createLivestockHealthEvent);

export default router;
