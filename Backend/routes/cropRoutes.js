import { Router } from 'express';
import { getCrops, addCrop } from '../controllers/cropController.js';
import { verifyToken } from '../authMiddleware.js';

const router = Router();

// Apply authentication to all crop routes
router.use(verifyToken);

// List all crops for the user's farm
router.get('/', getCrops);

// Register a new crop cycle
router.post('/', addCrop);

export default router;
