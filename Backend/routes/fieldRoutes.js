import express from 'express';
import { 
  addField, 
  getFieldsByFarm, 
  getFieldDetails, 
  updateField, 
  deleteField,
  assignCropToField
} from '../controllers/fieldController.js';
import { verifyToken, authorizeRole } from '../authMiddleware.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// Routes
router.post('/', authorizeRole(['farm_manager', 'super_admin']), addField);
router.get('/farm/:farmId', getFieldsByFarm);
router.get('/:id', getFieldDetails);
router.put('/:id', authorizeRole(['farm_manager', 'super_admin']), updateField);
router.delete('/:id', authorizeRole(['farm_manager', 'super_admin']), deleteField);
router.put('/:id/assign-crop', authorizeRole(['farm_manager', 'super_admin']), assignCropToField);

export default router;
