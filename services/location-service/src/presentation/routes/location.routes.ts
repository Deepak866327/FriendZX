import { Router, Request, Response } from 'express';
import { LocationController } from '../controllers/LocationController';

export function createLocationRoutes(controller: LocationController): Router {
  const router = Router();

  // Location endpoints
  router.post('/update', (req: Request, res: Response) => controller.updateLocation(req, res));
  router.get('/current', (req: Request, res: Response) => controller.getLocation(req, res));
  router.get('/nearby', (req: Request, res: Response) => controller.getNearby(req, res));
  router.get('/search', (req: Request, res: Response) => controller.searchLocations(req, res));
  router.get('/history', (req: Request, res: Response) => controller.getHistory(req, res));
  router.delete('/history', (req: Request, res: Response) => controller.clearHistory(req, res));

  // Health check
  router.get('/health', (req: Request, res: Response) => res.json({ status: 'ok' }));

  return router;
}