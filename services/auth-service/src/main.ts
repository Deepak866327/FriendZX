import express from 'express';
import session from 'express-session';
import RedisStore from 'connect-redis';
import Redis from 'ioredis';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import nodemailer from 'nodemailer';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { RedisCache } from '../../../shared/utils/RedisCache';
import { KafkaProducer } from '../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../shared/utils/logger';
import { PostgresUserRepository } from './infrastructure/adapters/database/PostgresUserRepository';
import { LoginUseCase } from './application/usecases/LoginUseCase';
import { RegisterUseCase } from './application/usecases/RegisterUseCase';
import { GoogleAuthUseCase } from './application/usecases/GoogleAuthUseCase';
import { ChangePasswordUseCase } from './application/usecases/ChangePasswordUseCase';
import { AuthController } from './presentation/controllers/AuthController';
import { createAuthRoutes } from './presentation/routes/auth.routes';
import { errorHandler, notFoundHandler } from './presentation/middleware/errorHandler';

dotenv.config();

const app = express();
const logger = new Logger('AuthService');
const PORT = process.env.PORT || 3001;

const OTP_TTL_SEC   = 10 * 60; // 10 minutes
const USERNAME_RE   = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/; // 3-20 chars, starts with letter

// ── Nodemailer transporter (optional — falls back to console log in dev) ──────
function createTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    logger.info(`[DEV OTP] ${to} → ${otp}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@app.com',
    to,
    subject: 'Your verification code',
    text: `Your verification code is: ${otp}\n\nExpires in 10 minutes. Do not share this code.`,
    html: `<p>Your verification code is: <strong style="font-size:24px;letter-spacing:4px">${otp}</strong></p><p>Expires in 10 minutes.</p>`,
  });
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session backed by Redis — only used for the OAuth state handshake (10 min)
const sessionRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
app.use(session({
  store: new RedisStore({ client: sessionRedis, prefix: 'auth:sess:' }),
  secret: process.env.SESSION_SECRET || 'oauth-session-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

// Initialize Database
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Initialize Redis
const redis = new RedisCache(process.env.REDIS_URL);

// Initialize Kafka
const kafkaProducer = new KafkaProducer('auth-service');

// Initialize Repository
const userRepository = new PostgresUserRepository(db, redis);

// Initialize Use Cases
const loginUseCase = new LoginUseCase(userRepository, kafkaProducer);
const registerUseCase = new RegisterUseCase(userRepository, kafkaProducer);
const googleAuthUseCase = new GoogleAuthUseCase(userRepository, kafkaProducer);
const changePasswordUseCase = new ChangePasswordUseCase(userRepository);

// Google OAuth Strategy
if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const result = await googleAuthUseCase.execute({
          googleId: profile.id,
          email: profile.emails?.[0]?.value || '',
          firstName: profile.name?.givenName || profile.displayName || '',
          lastName: profile.name?.familyName || '',
          profilePicture: profile.photos?.[0]?.value,
        });
        done(null, result);
      } catch (error) {
        done(error as Error);
      }
    }
  ));
  logger.info('Google OAuth strategy registered');
} else {
  logger.warn('Google OAuth not configured');
}

// Initialize Controller
const authController = new AuthController(loginUseCase, registerUseCase, changePasswordUseCase);

// ══════════════════════════════════════════════════════════════════════════════
//  OTP & username routes (handled before the main auth router)
// ══════════════════════════════════════════════════════════════════════════════

// POST /send-otp — generate & email a 6-digit code
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email address required' });
  }

  const existing = await userRepository.findByEmail(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const otp = generateOtp();
  await redis.set(`otp:${email}`, otp, OTP_TTL_SEC);

  try {
    await sendOtpEmail(email, otp);
    res.json({ message: 'OTP sent to your email address' });
  } catch (err) {
    logger.error(`Failed to send OTP email: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to send OTP email. Please try again.' });
  }
});

// POST /forgot-password — send password-reset OTP to a registered email
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email address required' });
  }

  const user = await userRepository.findByEmail(email);
  if (!user) {
    // Return success anyway to avoid email enumeration
    return res.json({ message: 'If that email is registered you will receive a reset code.' });
  }

  const otp = generateOtp();
  await redis.set(`reset:${email}`, otp, OTP_TTL_SEC);

  try {
    await sendOtpEmail(email, otp);
    logger.info(`Password reset OTP sent to ${email}`);
    res.json({ message: 'Reset code sent to your email address.' });
  } catch (err) {
    logger.error(`Failed to send reset email: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
});

// POST /reset-password — verify OTP and set new password
app.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'email, otp, and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const storedOtp = await redis.get<string>(`reset:${email}`);
  if (!storedOtp || storedOtp !== String(otp).trim()) {
    return res.status(400).json({ error: 'Invalid or expired reset code. Please request a new one.' });
  }

  const user = await userRepository.findByEmail(email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  try {
    const bcrypt = await import('bcryptjs');
    const hashed = await bcrypt.hash(newPassword, 10);
    await userRepository.updatePassword(user.id, hashed);
    await redis.del(`reset:${email}`);
    logger.info(`Password reset successful for ${email}`);
    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    logger.error(`Password reset failed: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// GET /username/check/:username — check availability
app.get('/username/check/:username', async (req, res) => {
  const { username } = req.params;
  if (!USERNAME_RE.test(username)) {
    return res.json({ available: false, error: 'Username must be 3-20 characters, start with a letter, and contain only letters, numbers, or underscores.' });
  }
  const existing = await userRepository.findByUsername(username);
  res.json({ available: !existing });
});

// POST /register — override to verify OTP then delegate to use case
app.post('/register', async (req, res) => {
  const { email, password, firstName, lastName, username, phoneNumber, otp } = req.body;

  if (!email || !password || !firstName || !username || !otp) {
    return res.status(400).json({ error: 'firstName, username, email, password, and otp are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Invalid username format (3-20 chars, start with letter, letters/numbers/underscores only)' });
  }

  const storedOtp = await redis.get<string>(`otp:${email}`);
  if (!storedOtp || storedOtp !== String(otp).trim()) {
    return res.status(400).json({ error: 'Invalid or expired OTP. Please request a new one.' });
  }

  try {
    const result = await registerUseCase.execute({ email, password, firstName, lastName: lastName || '', username, phoneNumber, otp });
    await redis.del(`otp:${email}`);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Mount remaining auth routes (login, logout, google oauth, etc.)
app.use('/', createAuthRoutes(authController));

app.get('/health', (_req, res) => res.json({ status: 'Auth Service is running', timestamp: new Date() }));

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await db.query('SELECT NOW()');
    logger.info('Connected to PostgreSQL');
    await redis.get('ping');
    logger.info('Connected to Redis');
    await kafkaProducer.connect();
    logger.info('Connected to Kafka');
    app.listen(PORT, () => logger.info(`Auth Service running on port ${PORT}`));
  } catch (error) {
    logger.error(`Failed to start service: ${(error as Error).message}`);
    process.exit(1);
  }
}

startServer();
export default app;
