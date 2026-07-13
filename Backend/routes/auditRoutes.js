import express from 'express';
import { verifyToken, authorizeRole } from '../authMiddleware.js';
import { getAuditLogs } from '../controllers/auditController.js';

const router = express.Router();

router.use(verifyToken);
// Only super admins and farm managers can view audit logs
router.get('/', authorizeRole(['farm_manager', 'super_admin']), getAuditLogs);

export default router;
