import express from 'express';
import { getSessions, getMessages, createSession, sendMessage, deleteSession } from '../controllers/chatController.js';
import { verifyToken } from '../authMiddleware.js';
import upload from '../uploadMiddleware.js';

const router = express.Router();

// Apply auth middleware to all chat routes
router.use(verifyToken);

router.get('/sessions', getSessions);
router.post('/sessions', createSession);
router.get('/sessions/:sessionId/messages', getMessages);
router.post('/message', upload.single('image'), sendMessage);
router.delete('/sessions/:sessionId', deleteSession);

export default router;
