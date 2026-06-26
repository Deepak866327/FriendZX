import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Logger } from '../../shared/utils/logger';

dotenv.config();

const app: Express = express();
const logger = new Logger('APIGateway');
const PORT = process.env.PORT || 3000;

// CORS — in dev reflect any origin so tunnel URLs (ngrok, cloudflared) work
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production'
      ? (process.env.CORS_ORIGIN?.split(',') || [])
      : true,
    credentials: true,
  })
);

// Rate Limiting (disabled in development)
if (process.env.NODE_ENV !== 'development') {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
}

// JWT Verification Middleware
const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const userId = (decoded as any).id;
    (req as any).userId = userId;
    req.headers['x-user-id'] = userId;
    next();
  } catch (err: any) {
    // 401 = not authenticated (expired or invalid) — frontend clears session and redirects to login
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: msg });
  }
};

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'API Gateway is running', timestamp: new Date() });
});

// Public Routes (No JWT required)
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: { '^/api/auth': '' },
    onError: (err, req, res) => {
      logger.error(`Auth service error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Auth service unavailable' });
    },
  })
);

// Protected Routes (JWT required)
app.use('/api/users', verifyToken);
app.use(
  '/api/users',
  createProxyMiddleware({
    target: process.env.USER_SERVICE_URL || 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: { '^/api/users': '' },
    onProxyReq: (proxyReq, req) => {
      const userId = (req as any).userId;
      if (userId) proxyReq.setHeader('x-user-id', userId);
    },
    onError: (err, req, res) => {
      logger.error(`User service error: ${err.message}`);
      (res as Response).status(503).json({ error: 'User service unavailable' });
    },
  })
);

app.use('/api/locations', verifyToken);
app.use(
  '/api/locations',
  createProxyMiddleware({
    target: process.env.LOCATION_SERVICE_URL || 'http://localhost:3003',
    changeOrigin: true,
    pathRewrite: { '^/api/locations': '' },
    onProxyReq: (proxyReq, req) => {
      const userId = (req as any).userId;
      if (userId) proxyReq.setHeader('x-user-id', userId);
    },
    onError: (err, req, res) => {
      logger.error(`Location service error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Location service unavailable' });
    },
  })
);

// Public — chat attachments served without auth (UUID is the access control)
app.use(
  '/api/notifications/chat/attachment',
  createProxyMiddleware({
    target: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004',
    changeOrigin: true,
    pathRewrite: { '^/api/notifications': '' },
    onError: (err, req, res) => {
      logger.error(`Chat attachment error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Notification service unavailable' });
    },
  })
);

app.use('/api/notifications', verifyToken);
app.use(
  '/api/notifications',
  createProxyMiddleware({
    target: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004',
    changeOrigin: true,
    pathRewrite: { '^/api/notifications': '' },
    onProxyReq: (proxyReq, req) => {
      const userId = (req as any).userId;
      if (userId) proxyReq.setHeader('x-user-id', userId);
    },
    onError: (err, req, res) => {
      logger.error(`Notification service error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Notification service unavailable' });
    },
  })
);

// Bluetooth is now merged into location-service (port 3003), REST routes at /bt/*
app.use('/api/bluetooth', verifyToken);
app.use(
  '/api/bluetooth',
  createProxyMiddleware({
    target: process.env.BLUETOOTH_SERVICE_URL || 'http://localhost:3003',
    changeOrigin: true,
    pathRewrite: { '^/api/bluetooth': '/bt' },
    ws: true,
    onProxyReq: (proxyReq, req) => {
      const userId = (req as any).userId;
      if (userId) proxyReq.setHeader('x-user-id', userId);
    },
    onError: (err, req, res) => {
      logger.error(`Bluetooth service error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Bluetooth service unavailable' });
    },
  })
);

// Media service (presigned URLs, upload completion, media CRUD)
app.use('/api/media', verifyToken);
app.use(
  '/api/media',
  createProxyMiddleware({
    target: process.env.POST_SERVICE_URL || 'http://localhost:3006',
    changeOrigin: true,
    pathRewrite: { '^/api/media': '/media' },
    onProxyReq: (proxyReq, req) => {
      const userId = (req as any).userId;
      if (userId) proxyReq.setHeader('x-user-id', userId);
    },
    onError: (err, req, res) => {
      logger.error(`Media service error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Post service unavailable' });
    },
  })
);

app.use('/api/communities', verifyToken);
app.use(
  '/api/communities',
  createProxyMiddleware({
    target: process.env.POST_SERVICE_URL || 'http://localhost:3006',
    changeOrigin: true,
    pathRewrite: { '^/api/communities': '/communities' },
    onProxyReq: (proxyReq, req) => {
      const userId = (req as any).userId;
      if (userId) proxyReq.setHeader('x-user-id', userId);
    },
    onError: (err, req, res) => {
      logger.error(`Community service error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Community service unavailable' });
    },
  })
);

app.use('/api/random-connect', verifyToken);
app.use(
  '/api/random-connect',
  createProxyMiddleware({
    target: process.env.RANDOM_CONNECT_SERVICE_URL || 'http://localhost:3007',
    changeOrigin: true,
    pathRewrite: { '^/api/random-connect': '' },
    ws: true,
    onProxyReq: (proxyReq, req) => {
      const userId = (req as any).userId;
      if (userId) proxyReq.setHeader('x-user-id', userId);
    },
    onError: (err, req, res) => {
      logger.error(`Random connect service error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Random connect service unavailable' });
    },
  })
);

// Public — cration video/thumbnail files served without auth
app.use(
  '/api/crations/uploads',
  createProxyMiddleware({
    target: process.env.POST_SERVICE_URL || 'http://localhost:3006',
    changeOrigin: true,
    pathRewrite: { '^/api/crations/uploads': '/crations/uploads' },
    onError: (err, req, res) => {
      logger.error(`Cration uploads error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Post service unavailable' });
    },
  })
);

app.use('/api/crations', verifyToken);
app.use(
  '/api/crations',
  createProxyMiddleware({
    target: process.env.POST_SERVICE_URL || 'http://localhost:3006',
    changeOrigin: true,
    pathRewrite: { '^/api/crations': '/crations' },
    onProxyReq: (proxyReq, req) => {
      const userId = (req as any).userId;
      if (userId) proxyReq.setHeader('x-user-id', userId);
    },
    onError: (err, req, res) => {
      logger.error(`Cration service error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Post service unavailable' });
    },
  })
);

// Public — uploaded images don't carry an Authorization header from <img> tags
app.use(
  '/api/posts/uploads',
  createProxyMiddleware({
    target: process.env.POST_SERVICE_URL || 'http://localhost:3006',
    changeOrigin: true,
    pathRewrite: { '^/api/posts/uploads': '/uploads' },
    onError: (err, req, res) => {
      logger.error(`Post uploads error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Post service unavailable' });
    },
  })
);

// Public — story media served without auth (used by <img> and <video> tags)
app.use(
  '/api/posts/stories/uploads',
  createProxyMiddleware({
    target: process.env.POST_SERVICE_URL || 'http://localhost:3006',
    changeOrigin: true,
    pathRewrite: { '^/api/posts/stories/uploads': '/stories/uploads' },
    onError: (err, req, res) => {
      logger.error(`Story uploads error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Post service unavailable' });
    },
  })
);

app.use('/api/posts', verifyToken);
app.use(
  '/api/posts',
  createProxyMiddleware({
    target: process.env.POST_SERVICE_URL || 'http://localhost:3006',
    changeOrigin: true,
    pathRewrite: { '^/api/posts': '' },
    onProxyReq: (proxyReq, req) => {
      const userId = (req as any).userId;
      if (userId) proxyReq.setHeader('x-user-id', userId);
    },
    onError: (err, req, res) => {
      logger.error(`Post service error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Post service unavailable' });
    },
  })
);

app.use('/api/challenges', verifyToken);
app.use(
  '/api/challenges',
  createProxyMiddleware({
    target: process.env.CHALLENGE_SERVICE_URL || 'http://localhost:3008',
    changeOrigin: true,
    pathRewrite: { '^/api/challenges': '' },
    onProxyReq: (proxyReq, req) => {
      const userId = (req as any).userId;
      if (userId) proxyReq.setHeader('x-user-id', userId);
    },
    onError: (err, req, res) => {
      logger.error(`Challenge service error: ${err.message}`);
      (res as Response).status(503).json({ error: 'Challenge service unavailable' });
    },
  })
);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found', source: 'api-gateway' });
});

// Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// Start Server
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Auth Service: ${process.env.AUTH_SERVICE_URL}`);
  logger.info(`User Service: ${process.env.USER_SERVICE_URL}`);
  logger.info(`Location Service: ${process.env.LOCATION_SERVICE_URL}`);
  logger.info(`Notification Service: ${process.env.NOTIFICATION_SERVICE_URL}`);
});

export default app;