import express from 'express';
import { verifyToken } from '../authMiddleware.js';
import upload from '../uploadMiddleware.js';
import { detectDisease, getDiseaseHistory } from '../controllers/aiController.js';

const router = express.Router();

router.post('/disease-detection', verifyToken, upload.single('image'), detectDisease);
router.get('/disease-history', verifyToken, getDiseaseHistory);

export default router;
