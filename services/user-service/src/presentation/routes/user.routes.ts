import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { UserController } from '../controllers/UserController';
import { RedisCache } from '../../../../../../shared/utils/RedisCache';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── Leaky-bucket: 2000 follows per 7 days ────────────────────────────────────
const BUCKET_CAPACITY    = 2000;
const BUCKET_WINDOW_SEC  = 7 * 24 * 60 * 60; // 604 800 s

function makeFollowRateLimiter(redis: RedisCache) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId as string;
    if (!userId) return next();

    const key = `follow:bucket:${userId}`;
    const now = Date.now() / 1000;

    try {
      const raw = await redis.get<{ count: number; lastLeakAt: number }>(key);

      let count = 0;
      if (raw) {
        const elapsed = now - raw.lastLeakAt;
        const leaked  = (elapsed / BUCKET_WINDOW_SEC) * BUCKET_CAPACITY;
        count = Math.max(0, raw.count - leaked);
      }

      if (count >= BUCKET_CAPACITY) {
        // How many seconds until one token leaks free
        const waitSec = Math.ceil(BUCKET_WINDOW_SEC / BUCKET_CAPACITY);
        return res.status(429).json({
          error: `You've reached the limit of ${BUCKET_CAPACITY} new follows per 7 days.`,
          retryAfter: waitSec,
        });
      }

      // Consume one token; TTL = full window so key auto-expires after 7 days of inactivity
      await redis.set(key, { count: count + 1, lastLeakAt: now }, BUCKET_WINDOW_SEC);
      next();
    } catch {
      next(); // Redis failure — fail open
    }
  };
}

export function createUserRoutes(controller: UserController, redis: RedisCache): Router {
  const router = Router();
  const followRateLimit = makeFollowRateLimiter(redis);

  // Profile
  router.get('/profile',       (req: Request, res: Response) => controller.getProfile(req, res));
  router.put('/profile',       (req: Request, res: Response) => controller.updateProfile(req, res));
  router.get('/public/:userId',(req: Request, res: Response) => controller.getPublicProfile(req, res));

  // Photo upload
  router.post('/profile/photo', upload.single('photo'), (req: Request, res: Response) => controller.uploadPhoto(req, res));

  // Activity
  router.get('/activity', (req: Request, res: Response) => controller.getActivity(req, res));

  // Follow — rate-limited
  router.post('/:id/follow',   followRateLimit, (req: Request, res: Response) => controller.followUser(req, res));
  router.delete('/:id/follow', (req: Request, res: Response) => controller.unfollowUser(req, res));
  router.get('/followers',     (req: Request, res: Response) => controller.getFollowers(req, res));
  router.get('/following',     (req: Request, res: Response) => controller.getFollowing(req, res));
  router.delete('/followers/:followerId', (req: Request, res: Response) => controller.removeFollower(req, res));

  // Search / discover
  router.get('/search',            (req: Request, res: Response) => controller.searchUsers(req, res));
  router.get('/search/interests',  (req: Request, res: Response) => controller.searchByInterests(req, res));
  router.get('/discover',          (req: Request, res: Response) => controller.discoverUsers(req, res));

  router.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));

  return router;
}
