import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import livestockRoutes from './routes/livestockRoutes.js';
import cropRoutes from './routes/cropRoutes.js';
import blockRoutes from './routes/blockRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import cropObservationRoutes from './routes/cropObservationRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import salaryRoutes from './routes/salaryRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import fieldRoutes from './routes/fieldRoutes.js';
import { verifyToken } from './authMiddleware.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Register API routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/livestock', livestockRoutes);
app.use('/api/crops', cropRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/crop-observations', cropObservationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/fields', fieldRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Backend listening on port ${PORT}`);
});
