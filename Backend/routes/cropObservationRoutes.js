import express from 'express';
import { verifyToken } from '../authMiddleware.js';
import { createCropObservation, getRecentObservations } from '../controllers/cropObservationController.js';

const router = express.Router();

router.use(verifyToken);

router.post('/', createCropObservation);
router.get('/recent', getRecentObservations);

export default router;
