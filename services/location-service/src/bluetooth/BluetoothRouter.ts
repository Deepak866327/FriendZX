import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import { getGpsNearby } from './BluetoothService';
import { BtConfig } from './BluetoothSocketHandler';

/**
 * REST routes for bluetooth functionality.
 * Mounted at /bt in the combined location-service.
 */
export function createBluetoothRouter(
  redis: Redis,
  userSockets: Map<string, Set<string>>,
  config: BtConfig,
): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'Bluetooth running (merged into location-service)',
      activeUsers: userSockets.size,
      timestamp: new Date(),
    });
  });

  router.get('/nearby/:userId', async (req: Request, res: Response) => {
    const { userId } = req.params;
    const radiusM = Math.min(
      parseInt(req.query.radiusM as string) || config.defaultRadiusM,
      config.maxRadiusM,
    );
    const nearby = await getGpsNearby(redis, userId, radiusM);
    res.json({ users: nearby, radiusM });
  });

  return router;
}
