import { Router } from 'express';
import { getCrops, addCrop, deleteCrop, getCropWeatherAdvice } from '../controllers/cropController.js';
import { verifyToken } from '../authMiddleware.js';

const router = Router();

// Apply authentication to all crop routes
router.use(verifyToken);

// List all crops for the user's farm
router.get('/', getCrops);

// Weather-driven irrigation, harvest and planting advice for today and tomorrow
router.get('/weather-advice', getCropWeatherAdvice);

// Register a new crop cycle
router.post('/', addCrop);

// Delete a crop cycle
router.delete('/:id', deleteCrop);

export default router;
