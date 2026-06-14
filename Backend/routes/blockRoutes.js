import { Router } from 'express';
import { getBlocks } from '../controllers/blockController.js';
import { verifyToken } from '../authMiddleware.js';

const router = Router();

router.use(verifyToken);
router.get('/', getBlocks);

export default router;
