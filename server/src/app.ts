import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import qrRoutes from './routes/qr';
import attendanceRoutes from './routes/attendance';
import bddRoutes from './routes/bdd';
import leaveRoutes from './routes/leaves';
import expenseRoutes from './routes/expenses';
import payrollRoutes from './routes/payroll';
import performanceRoutes from './routes/performance';
import notificationRoutes from './routes/notifications';
import broadcastRoutes from './routes/broadcasts';
import adminRoutes from './routes/admin';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigins = new Set([
    env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:4173',
  ]);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  }));
  app.use(morgan('dev'));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=(self)');
    next();
  });
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready', timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('[Healthcheck] readiness probe failed', error);
      res.status(503).json({ status: 'degraded', timestamp: new Date().toISOString() });
    }
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/qr', qrRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/bdd', bddRoutes);
  app.use('/api/leaves', leaveRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/payroll', payrollRoutes);
  app.use('/api/performance', performanceRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/broadcasts', broadcastRoutes);
  app.use('/api/admin', adminRoutes);

  // Catch-all for undefined /api/* paths — return JSON 404 instead of falling through to the SPA
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
  });

  // Serve frontend in production
  if (env.NODE_ENV === 'production') {
    const clientBuild = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientBuild));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(clientBuild, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
