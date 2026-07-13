import express from 'express';
import { getShifts, createShift, updateShift, deleteShift } from '../controllers/shiftController.js';
import { verifyToken } from '../authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getShifts);
router.post('/', createShift);
router.put('/:id', updateShift);
router.delete('/:id', deleteShift);

export default router;
