import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { RedisGeoCache } from '../../../shared/utils/RedisCache';
import { KafkaProducer } from '../../../shared/adapters/kafka/KafkaProducer';
import { KafkaConsumer } from '../../../shared/adapters/kafka/KafkaConsumer';
import { Logger } from '../../../shared/utils/logger';
import { initBluetoothSocket } from './bluetooth/BluetoothSocketHandler';
import { createBluetoothRouter } from './bluetooth/BluetoothRouter';
import { MongoLocationRepository } from './infrastructure/adapters/database/MongoLocationRepository';
import { UpdateLocationUseCase } from './application/usecases/UpdateLocationUseCase';
import { GetNearbyUseCase } from './application/usecases/GetNearbyUseCase';
import { SearchLocationsUseCase } from './application/usecases/SearchLocationsUseCase';
import { GetLocationHistoryUseCase } from './application/usecases/GetLocationHistoryUseCase';
import { LocationController } from './presentation/controllers/LocationController';
import { createLocationRoutes } from './presentation/routes/location.routes';
import { errorHandler, notFoundHandler, authMiddleware } from './presentation/middleware/errorHandler';

dotenv.config();

const app    = express();
const server = http.createServer(app);
const logger = new Logger('LocationService');
const PORT   = process.env.PORT || 3003;

// ── Bluetooth config ──────────────────────────────────────────────────────────
const btConfig = {
  maxRadiusM:    parseInt(process.env.BT_MAX_RADIUS_M    || '200'),
  defaultRadiusM:parseInt(process.env.BT_DEFAULT_RADIUS_M || '50'),
  presenceTtlS:  parseInt(process.env.BT_PRESENCE_TTL_S  || '45'),
};

// Separate Redis instance for Bluetooth (uses bt: key namespace)
const btRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Socket.IO on the same server — Vite/gateway proxy path /bluetooth-ws rewrites to /socket.io
const btIo = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize MongoDB connection
const mongoURL = process.env.MONGODB_URL || 'mongodb://localhost:27017/location_db';

// Define Location Schema
const locationSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  address: String,
  accuracy: Number,
  altitude: Number,
  heading: Number,
  speed: Number,
  timestamp: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Create geospatial index
locationSchema.index({ coordinates: '2dsphere' });
locationSchema.index({ 'userId': 1, 'updatedAt': -1 });

const LocationModel = mongoose.model('Location', locationSchema);

// Define Location History Schema
const locationHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  address: String,
  timestamp: { type: Date, default: Date.now, index: true },
  createdAt: { type: Date, default: Date.now, index: true, expires: 2592000 }, // 30 days TTL
});

locationHistorySchema.index({ 'userId': 1, 'timestamp': -1 });
locationHistorySchema.index({ coordinates: '2dsphere' });

const LocationHistoryModel = mongoose.model('LocationHistory', locationHistorySchema);

// Initialize Redis Geo
const redisGeo = new RedisGeoCache(process.env.REDIS_GEO_URL);

// Initialize Kafka
const kafkaProducer = new KafkaProducer('location-service');
const kafkaConsumer = new KafkaConsumer('location-service', 'location-service-group');

// Initialize Repository
const locationRepository = new MongoLocationRepository(LocationModel, LocationHistoryModel, redisGeo);

// Initialize Use Cases
const updateLocationUseCase = new UpdateLocationUseCase(locationRepository, kafkaProducer);
const getNearbyUseCase = new GetNearbyUseCase(locationRepository);
const searchLocationsUseCase = new SearchLocationsUseCase(locationRepository);
const getLocationHistoryUseCase = new GetLocationHistoryUseCase(locationRepository);

// Initialize Controller
const locationController = new LocationController(
  updateLocationUseCase,
  getNearbyUseCase,
  searchLocationsUseCase,
  getLocationHistoryUseCase
);

app.use((req, res, next) => {
  (req as any).userId = req.headers['x-user-id'];
  next();
});

// Routes
app.use('/', createLocationRoutes(locationController));

// ── Bluetooth: REST routes (mounted at /bt) ───────────────────────────────────
// Initialise Socket.IO handlers first so userSockets is available for the router
const btUserSockets = initBluetoothSocket(btIo, btRedis, kafkaProducer, btConfig);
app.use('/bt', createBluetoothRouter(btRedis, btUserSockets, btConfig));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'Location Service is running', timestamp: new Date() });
});

// Event Handlers
async function setupEventHandlers() {
  try {
    // Listen for location updates
    await kafkaConsumer.subscribe('location.updated', async (message) => {
      try {
        logger.info(`Location updated event received for user: ${message.userId}`);
        // Process location update events if needed
      } catch (error) {
        logger.error(`Error processing location.updated event: ${(error as Error).message}`);
      }
    });

    // Listen for user deletion
    await kafkaConsumer.subscribe('user.deleted', async (message) => {
      try {
        logger.info(`User deleted event received: ${message.userId}`);
        
        // Delete user location and history
        await locationRepository.deleteLocation(message.userId);
        await locationRepository.clearHistory(message.userId);
      } catch (error) {
        logger.error(`Error processing user.deleted event: ${(error as Error).message}`);
      }
    });

    await kafkaConsumer.run();
  } catch (error) {
    logger.error(`Error setting up event handlers: ${(error as Error).message}`);
  }
}

// 404 & Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(mongoURL);
    logger.info('Connected to MongoDB');

    // Connect to Redis Geo (connection is established lazily on first command)
    logger.info('Redis Geo initialized');

    // Connect to Kafka
    await kafkaProducer.connect();
    logger.info('Connected to Kafka Producer');

    await kafkaConsumer.connect();
    logger.info('Connected to Kafka Consumer');

    // Setup event handlers
    await setupEventHandlers();

    server.listen(PORT, () => {
      logger.info(`Location+Bluetooth Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to start service: ${(error as Error).message}`);
    process.exit(1);
  }
}

startServer();

export default app;