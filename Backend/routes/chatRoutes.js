import { Router } from 'express';
import { authorizeRole, verifyToken } from '../authMiddleware.js';
import { deleteChatSession, getChatHistory, postChatMessage } from '../controllers/chatController.js';

const router = Router();

router.use(verifyToken);
router.use(authorizeRole(['super_admin', 'farm_manager', 'worker']));

router.post('/', postChatMessage);
router.get('/history', getChatHistory);
router.delete('/session/:id', deleteChatSession);

export default router;

