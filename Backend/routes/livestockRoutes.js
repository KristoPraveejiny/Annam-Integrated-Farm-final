import express from 'express';
import { getLivestock, addLivestock, getLivestockGroups } from '../controllers/livestockController.js';
import { verifyToken } from '../authMiddleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(verifyToken);

// GET /api/livestock/groups - Fetch available livestock groups (Cow, Hens, Ducks, etc.)
router.get('/groups', getLivestockGroups);

// GET /api/livestock - Fetch all animals for the user's farm
router.get('/', getLivestock);

// POST /api/livestock - Add a new animal
router.post('/', addLivestock);

export default router;
