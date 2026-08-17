import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import { createLivestockHealthEvent, getLivestockHealthEvents, updateLivestockHealthEvent } from '../controllers/livestockHealthController.js';
import upload from '../uploadMiddleware.js';

const router = express.Router();

router.use(verifyToken);
router.get('/', authorizeRole(['farm_manager', 'super_admin', 'worker', 'farmer']), getLivestockHealthEvents);
router.post('/', authorizeRole(['farm_manager', 'super_admin', 'worker', 'farmer']), upload.single('image'), createLivestockHealthEvent);
router.put('/:id', authorizeRole(['farm_manager', 'super_admin', 'worker', 'farmer']), updateLivestockHealthEvent);

export default router;
