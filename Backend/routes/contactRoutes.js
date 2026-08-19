import express from 'express';
import {
  submitContactMessage,
  getContactMessages,
  getContactMessageById,
  updateContactMessageStatus,
  replyToContactMessage,
  deleteContactMessage,
} from '../controllers/contactController.js';
import { verifyToken, authorizeRole } from '../authMiddleware.js';

const router = express.Router();

// Public — the website contact form posts here.
router.post('/', submitContactMessage);

// Admin — enquiry management.
const adminOnly = [verifyToken, authorizeRole(['super_admin', 'admin'])];

router.get('/', adminOnly, getContactMessages);
router.get('/:id', adminOnly, getContactMessageById);
router.put('/:id/status', adminOnly, updateContactMessageStatus);
router.post('/:id/reply', adminOnly, replyToContactMessage);
router.delete('/:id', adminOnly, deleteContactMessage);

export default router;
