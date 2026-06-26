import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { KafkaConsumer } from '../../../shared/adapters/kafka/KafkaConsumer';
import { Logger } from '../../../shared/utils/logger';
import { RedisNotificationRepository } from './infrastructure/adapters/database/RedisNotificationRepository';
import { SocketIOAdapter } from './infrastructure/adapters/websocket/SocketIOAdapter';
import { GetNotificationsUseCase } from './application/usecases/GetNotificationsUseCase';
import { MarkAsReadUseCase } from './application/usecases/MarkAsReadUseCase';
import { SendNotificationUseCase } from './application/usecases/SendNotificationUseCase';
import { UserEventHandler } from './application/handlers/UserEventHandler';
import { ProfileEventHandler } from './application/handlers/ProfileEventHandler';
import { LocationEventHandler } from './application/handlers/LocationEventHandler';
import { NotificationController } from './presentation/controllers/NotificationController';
import { createNotificationRoutes } from './presentation/routes/notification.routes';
import { errorHandler, notFoundHandler, authMiddleware } from './presentation/middleware/errorHandler';

dotenv.config();

const app = express();
const server = http.createServer(app);
const logger = new Logger('NotificationService');
const PORT = process.env.PORT || 3004;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Chat attachment storage ────────────────────────────────────────────────
const CHAT_UPLOADS_DIR = process.env.CHAT_UPLOADS_DIR || path.join(__dirname, '..', 'chat-uploads');
if (!fs.existsSync(CHAT_UPLOADS_DIR)) fs.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true });

const chatUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CHAT_UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// Separate Redis client for chat metadata (public keys, once-view)
const chatRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Initialize Repository
const notificationRepository = new RedisNotificationRepository(process.env.REDIS_URL);

// Initialize WebSocket Adapter
const socketIOAdapter = new SocketIOAdapter(server, notificationRepository);

// Initialize Use Cases
const getNotificationsUseCase = new GetNotificationsUseCase(notificationRepository);
const markAsReadUseCase = new MarkAsReadUseCase(notificationRepository);
const sendNotificationUseCase = new SendNotificationUseCase(notificationRepository);

// Initialize Event Handlers
const userEventHandler = new UserEventHandler(sendNotificationUseCase);
const profileEventHandler = new ProfileEventHandler(sendNotificationUseCase);
const locationEventHandler = new LocationEventHandler(sendNotificationUseCase);

// Initialize Controller
const notificationController = new NotificationController(
  getNotificationsUseCase,
  markAsReadUseCase,
  sendNotificationUseCase
);

app.use((req, res, next) => {
  (req as any).userId = req.headers['x-user-id'];
  next();
});

// Routes
app.use('/', createNotificationRoutes(notificationController));

// Conversations list endpoint
app.get('/conversations', async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 50);
  try {
    const conversations = await socketIOAdapter.getConversations(userId, limit);
    res.json({ conversations });
  } catch {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Delete conversation (clears messages + removes from conversation index)
app.delete('/conversations/:partnerId', async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await socketIOAdapter.deleteConversation(userId, req.params.partnerId);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Chat history endpoint
app.get('/chat/:toUserId', async (req, res) => {
  const fromUserId = (req as any).userId;
  const { toUserId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  if (!fromUserId) return res.status(401).json({ error: 'Unauthorized' });
  const messages = await socketIOAdapter.getChatHistory(fromUserId, toUserId, limit);
  res.json({ messages });
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'Notification Service is running',
    connectedUsers: socketIOAdapter.getConnectedUsersCount(),
    timestamp: new Date(),
  });
});

// Initialize Kafka Consumer
const kafkaConsumer = new KafkaConsumer('notification-service', 'notification-service-group');

// Event Handlers
async function setupEventHandlers() {
  try {
    // User Service Events
    await kafkaConsumer.subscribe('user.registered', async (message) => {
      logger.info(`Received user.registered event`);
      await userEventHandler.handleUserRegistered(message);
      
      // Send real-time notification via WebSocket
      await socketIOAdapter.sendToUser(message.userId, 'notification:received', {
        title: 'Welcome!',
        message: 'Welcome to our platform!',
      });
    });

    await kafkaConsumer.subscribe('user.logged-in', async (message) => {
      logger.info(`Received user.logged-in event`);
      await userEventHandler.handleUserLoggedIn(message);
    });

    // Profile Service Events
    await kafkaConsumer.subscribe('user.followed', async (message) => {
      logger.info(`Received user.followed event`);
      await profileEventHandler.handleUserFollowed(message);

      const followerName = message.followerFirstName
        ? `${message.followerFirstName}${message.followerLastName ? ' ' + message.followerLastName : ''}`
        : 'Someone';

      await socketIOAdapter.sendToUser(message.userId, 'notification:received', {
        title: 'New Friend Request!',
        message: `${followerName} added you as a friend.`,
        type: 'user_followed',
        data: {
          fromUserId: message.followerId,
          fromName: followerName,
        },
      });
    });

    await kafkaConsumer.subscribe('user.unfollowed', async (message) => {
      logger.info(`Received user.unfollowed event`);
      await profileEventHandler.handleUserUnfollowed(message);
    });

    await kafkaConsumer.subscribe('user.profile.updated', async (message) => {
      logger.info(`Received user.profile.updated event`);
      await profileEventHandler.handleProfileUpdated(message);
    });

    // Location Service Events
    await kafkaConsumer.subscribe('location.updated', async (message) => {
      logger.info(`Received location.updated event`);
      await locationEventHandler.handleLocationUpdated(message);
    });

    await kafkaConsumer.subscribe('user.nearby.found', async (message) => {
      logger.info(`Received user.nearby.found event`);
      await locationEventHandler.handleNearbyUserFound(message);

      if (message.nearbyUsers && message.nearbyUsers.length > 0) {
        await socketIOAdapter.sendToUser(message.userId, 'location:nearby-users', {
          nearbyUsers: message.nearbyUsers,
          distance: message.radius,
        });
      }
    });

    // ── Challenge Events ────────────────────────────────────────────────────

    await kafkaConsumer.subscribe('challenge.friend.created', async (message) => {
      logger.info(`Received challenge.friend.created: ${message.challengeId}`);
      // Notify the opponent that a challenge was sent to them
      await socketIOAdapter.sendToUser(message.opponentId, 'notification:received', {
        title: '⚡ New Challenge!',
        message: 'Your friend challenged you! Check the chat to accept.',
        type: 'challenge_received',
        data: {
          challengeId: message.challengeId,
          fromUserId: message.creatorId,
        },
      });
    });

    await kafkaConsumer.subscribe('challenge.friend.completed', async (message) => {
      logger.info(`Received challenge.friend.completed: ${message.challengeId}`);

      const { challengeId, creatorId, opponentId, creatorScore, opponentScore, winner } = message;

      const resultPayload = {
        challengeId,
        creatorId,
        opponentId,
        creatorScore,
        opponentScore,
        winner, // userId or 'draw'
      };

      // Push full result to both players via dedicated event
      await socketIOAdapter.sendToUser(creatorId,  'challenge:result', resultPayload);
      await socketIOAdapter.sendToUser(opponentId, 'challenge:result', resultPayload);

      // Personalised notification-bell entries for each player
      const outcomeFor = (userId: string) =>
        winner === 'draw'   ? "It's a draw! 🤝"
        : winner === userId ? 'You won! 🏆'
        :                     'You lost 😢';

      await socketIOAdapter.sendToUser(creatorId, 'notification:received', {
        title: '⚡ Challenge Result!',
        message: `Your score: ${creatorScore}/10 — Opponent: ${opponentScore}/10 — ${outcomeFor(creatorId)}`,
        type: 'challenge_result',
        data: resultPayload,
      });

      await socketIOAdapter.sendToUser(opponentId, 'notification:received', {
        title: '⚡ Challenge Result!',
        message: `Your score: ${opponentScore}/10 — Opponent: ${creatorScore}/10 — ${outcomeFor(opponentId)}`,
        type: 'challenge_result',
        data: resultPayload,
      });
    });

    await kafkaConsumer.run();
    logger.info('Kafka event handlers set up successfully');
  } catch (error) {
    logger.error(`Error setting up event handlers: ${(error as Error).message}`);
  }
}

// ── ECDH Public Key (E2EE) ────────────────────────────────────────────────

app.post('/chat/public-key', async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { publicKey } = req.body;
  if (!publicKey) return res.status(400).json({ error: 'publicKey required' });
  await chatRedis.set(`chat:pubkey:${userId}`, JSON.stringify(publicKey), 'EX', 60 * 60 * 24 * 365);
  res.json({ ok: true });
});

app.get('/chat/public-key/:userId', async (req, res) => {
  const raw = await chatRedis.get(`chat:pubkey:${req.params.userId}`);
  if (!raw) return res.status(404).json({ error: 'Public key not found — user has not enabled E2EE yet' });
  res.json({ publicKey: JSON.parse(raw) });
});

// ── Chat attachment upload ─────────────────────────────────────────────────
// Allowed: image/* (once-view), video/* (once-view, ≤30s), audio/* (voice, 24h TTL)
// Rejected: documents

app.post('/chat/upload', chatUpload.single('file'), async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const file = (req as any).file as Express.Multer.File;
  if (!file) return res.status(400).json({ error: 'No file provided' });

  const msgType = (req.body.type as string) || 'image'; // image | video | voice

  // Reject documents
  if (msgType === 'document' || msgType === 'once-doc' || msgType === 'once-image') {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Only images, videos, and voice notes are allowed' });
  }
  if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/') && !file.mimetype.startsWith('audio/')) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Only images, videos, and voice notes are allowed' });
  }

  const attachmentId = path.parse(file.filename).name;

  if (msgType === 'image' || msgType === 'video') {
    // Image/video: always once-view — deleted after first serve
    await chatRedis.set(`once:${attachmentId}`, JSON.stringify({
      filePath: file.path,
      mimeType: file.mimetype,
    }), 'EX', 60 * 60 * 24 * 7); // 7-day max lifetime
  } else if (msgType === 'voice') {
    // Voice notes: 24-hour TTL
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    await chatRedis.set(`voice:${attachmentId}`, JSON.stringify({
      filePath: file.path,
      mimeType: file.mimetype,
      expiresAt,
    }), 'EX', 60 * 60 * 24);
  }

  res.json({
    attachmentId,
    url: `/notifications/chat/attachment/${file.filename}`,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
  });
});

// ── Serve attachment ───────────────────────────────────────────────────────
// Image/video: serve once then delete (once-view).
// Voice: serve normally, auto-expire after 24h.
// No auth — UUID is the access control.

app.get('/chat/attachment/:filename', async (req, res) => {
  const { filename } = req.params;
  const attachmentId = path.parse(filename).name;
  const filePath     = path.join(CHAT_UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Attachment not found or already viewed' });

  // Check voice TTL
  const voiceMeta = await chatRedis.get(`voice:${attachmentId}`);
  if (voiceMeta) {
    const meta = JSON.parse(voiceMeta);
    if (Date.now() > meta.expiresAt) {
      fs.unlinkSync(filePath);
      await chatRedis.del(`voice:${attachmentId}`);
      return res.status(404).json({ error: 'Voice note has expired' });
    }
    return res.sendFile(filePath); // voice: serve without deleting
  }

  // Image/video: serve then delete (once-view)
  const onceMeta = await chatRedis.get(`once:${attachmentId}`);
  if (onceMeta) {
    res.sendFile(filePath, async () => {
      try {
        await chatRedis.del(`once:${attachmentId}`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {}
    });
    return;
  }

  // Fallback: serve if file exists but has no Redis metadata
  res.sendFile(filePath);
});

// 404 & Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
async function startServer() {
  try {
    // Connect to Kafka
    await kafkaConsumer.connect();
    logger.info('Connected to Kafka Consumer');

    // Setup event handlers
    await setupEventHandlers();

    server.listen(PORT, () => {
      logger.info(`Notification Service running on port ${PORT}`);
      logger.info(`WebSocket server enabled`);
    });
  } catch (error) {
    logger.error(`Failed to start service: ${(error as Error).message}`);
    process.exit(1);
  }
}

startServer();

export default app;