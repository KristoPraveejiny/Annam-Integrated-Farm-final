import express from 'express';
import { getSiteContent } from '../controllers/siteContentController.js';

const router = express.Router();

router.get('/', getSiteContent);

export default router;
