import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { RedisCache } from '../../../shared/utils/RedisCache';
import { KafkaProducer } from '../../../shared/adapters/kafka/KafkaProducer';
import { KafkaConsumer } from '../../../shared/adapters/kafka/KafkaConsumer';
import { Logger } from '../../../shared/utils/logger';
import { PostgresUserProfileRepository } from './infrastructure/adapters/database/PostgresUserProfileRepository';
import { GetProfileUseCase } from './application/usecases/GetProfileUseCase';
import { UpdateProfileUseCase } from './application/usecases/UpdateProfileUseCase';
import { GetActivityUseCase } from './application/usecases/GetActivityUseCase';
import { FollowUserUseCase } from './application/usecases/FollowUserUseCase';
import { UnfollowUserUseCase } from './application/usecases/UnfollowUserUseCase';
import { GetFollowersUseCase } from './application/usecases/GetFollowersUseCase';
import { GetFollowingUseCase } from './application/usecases/GetFollowingUseCase';
import { SearchUsersUseCase } from './application/usecases/SearchUsersUseCase';
import { UserController } from './presentation/controllers/UserController';
import { createUserRoutes } from './presentation/routes/user.routes';
import { errorHandler, notFoundHandler, authMiddleware } from './presentation/middleware/errorHandler';

dotenv.config();

const app = express();
const logger = new Logger('UserService');
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Database
const db = new Pool({
  connectionString: process.env.USER_DATABASE_URL,
});

// Initialize Redis
const redis = new RedisCache(process.env.REDIS_URL);

// Initialize Kafka
const kafkaProducer = new KafkaProducer('user-service');
const kafkaConsumer = new KafkaConsumer('user-service', 'user-service-group');

// Initialize Repository
const userProfileRepository = new PostgresUserProfileRepository(db, redis);

// Initialize Use Cases
const getProfileUseCase = new GetProfileUseCase(userProfileRepository);
const updateProfileUseCase = new UpdateProfileUseCase(userProfileRepository, kafkaProducer);
const getActivityUseCase = new GetActivityUseCase(userProfileRepository);
const followUserUseCase = new FollowUserUseCase(userProfileRepository, kafkaProducer);
const unfollowUserUseCase = new UnfollowUserUseCase(userProfileRepository, kafkaProducer);
const getFollowersUseCase = new GetFollowersUseCase(userProfileRepository);
const getFollowingUseCase = new GetFollowingUseCase(userProfileRepository);
const searchUsersUseCase = new SearchUsersUseCase(userProfileRepository);

// Initialize Controller
const userController = new UserController(
  getProfileUseCase,
  updateProfileUseCase,
  getActivityUseCase,
  followUserUseCase,
  unfollowUserUseCase,
  getFollowersUseCase,
  getFollowingUseCase,
  searchUsersUseCase
);

app.use((req, res, next) => {
  (req as any).userId = req.headers['x-user-id'];
  next();
});

// Internal service-to-service: get following list for any userId (no auth required)
app.get('/following/:userId', async (req, res) => {
  try {
    const list = await getFollowingUseCase.execute(req.params.userId, 200, 0);
    res.json({ following: list.map((u: any) => ({ userId: u.userId || u })) });
  } catch { res.json({ following: [] }); }
});
app.get('/followers/:userId', async (req, res) => {
  try {
    const list = await (userProfileRepository as any).getFollowers(req.params.userId, 200, 0);
    res.json({ followers: (Array.isArray(list) ? list : []).map((u: any) => ({ userId: u.userId || u.follower_id || u })) });
  } catch { res.json({ followers: [] }); }
});

// Routes
app.use('/', createUserRoutes(userController, redis));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'User Service is running', timestamp: new Date() });
});

// Event Handlers
async function setupEventHandlers() {
  try {
    // Listen for user registration
    await kafkaConsumer.subscribe('user.registered', async (message) => {
      try {
        logger.info(`User registered event received: ${message.userId}`);

        const existing = await userProfileRepository.findById(message.userId);
        if (!existing) {
          await (userProfileRepository as any).create({
            userId: message.userId,
            firstName: message.firstName || '',
            lastName: message.lastName || '',
            username: message.username || null,
            bio: '',
            location: '',
            interests: [],
            photos: [],
            followers: 0,
            following: 0,
          });
        }
      } catch (error) {
        logger.error(`Error processing user.registered event: ${(error as Error).message}`);
      }
    });

    // Listen for user deletion
    await kafkaConsumer.subscribe('user.deleted', async (message) => {
      try {
        logger.info(`User deleted event received: ${message.userId}`);
        
        // Delete user profile
        await userProfileRepository.delete(message.userId);
      } catch (error) {
        logger.error(`Error processing user.deleted event: ${(error as Error).message}`);
      }
    });

    await kafkaConsumer.run();
  } catch (error) {
    logger.error(`Error setting up event handlers: ${(error as Error).message}`);
  }
}

// Mutual-follow relationship check
app.get('/relationship/:targetUserId', async (req, res) => {
  const currentUserId = (req as any).userId;
  const { targetUserId } = req.params;
  if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    // isFollowing(userId, followerId) = "followerId follows userId"
    const [isFollowing, isFollower] = await Promise.all([
      userProfileRepository.isFollowing(targetUserId, currentUserId), // I follow them
      userProfileRepository.isFollowing(currentUserId, targetUserId), // they follow me
    ]);
    res.json({ isFollowing, isFollower, isMutual: isFollowing && isFollower });
  } catch {
    res.status(500).json({ error: 'Failed to check relationship' });
  }
});

// 404 & Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
async function startServer() {
  try {
    // Connect to database
    await db.query('SELECT NOW()');
    logger.info('Connected to PostgreSQL');

    // Connect to Redis
    await redis.get('ping');
    logger.info('Connected to Redis');

    // Connect to Kafka
    await kafkaProducer.connect();
    logger.info('Connected to Kafka Producer');

    await kafkaConsumer.connect();
    logger.info('Connected to Kafka Consumer');

    // Setup event handlers
    await setupEventHandlers();

    app.listen(PORT, () => {
      logger.info(`User Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to start service: ${(error as Error).message}`);
    process.exit(1);
  }
}

startServer();

export default app;