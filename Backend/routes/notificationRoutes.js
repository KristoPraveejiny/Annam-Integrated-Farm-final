import express from 'express';
import { verifyToken } from '../authMiddleware.js';
import { getNotifications, markAsRead } from '../controllers/notificationController.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);

export default router;
