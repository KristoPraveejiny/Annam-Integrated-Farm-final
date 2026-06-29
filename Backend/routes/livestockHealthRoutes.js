import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import { createLivestockHealthEvent, getLivestockHealthEvents } from '../controllers/livestockHealthController.js';

const router = express.Router();

router.use(verifyToken);
router.get('/', authorizeRole(['farm_manager']), getLivestockHealthEvents);
router.post('/', authorizeRole(['farm_manager']), createLivestockHealthEvent);

export default router;
