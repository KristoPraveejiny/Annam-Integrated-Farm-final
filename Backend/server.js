import './loadEnv.js';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
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
import siteContentRoutes from './routes/siteContentRoutes.js';
import fieldRoutes from './routes/fieldRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import feedRequirementRoutes from './routes/feedRequirementRoutes.js';
import feedScheduleRoutes from './routes/feedScheduleRoutes.js';
import livestockHealthRoutes from './routes/livestockHealthRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import shiftRoutes from './routes/shiftRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import diseaseReportRoutes from './routes/diseaseReportRoutes.js';
import importRoutes from './routes/importRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import { verifyToken } from './authMiddleware.js';
import './services/workforceCron.js';


import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Pass io to request object
app.use((req, res, next) => {
  req.io = io;
  next();
});

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
app.use('/api/disease-reports', diseaseReportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/site-content', siteContentRoutes);
app.use('/api/fields', fieldRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/livestock/feed-requirements', feedRequirementRoutes);
app.use('/api/livestock/feed-schedules', feedScheduleRoutes);
app.use('/api/livestock/health-events', livestockHealthRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/import', importRoutes);
app.use('/api/analytics', analyticsRoutes);

const PORT = process.env.PORT || 5001;

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  // Example: Client joins their own user room
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
    console.log(`🚀 Backend listening on port ${PORT}`);
});
