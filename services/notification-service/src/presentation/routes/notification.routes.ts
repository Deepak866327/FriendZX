import { Router, Request, Response } from 'express';
import { NotificationController } from '../controllers/NotificationController';

export function createNotificationRoutes(controller: NotificationController): Router {
  const router = Router();

  // Notification endpoints
  router.get('/', (req: Request, res: Response) => controller.getNotifications(req, res));
  router.post('/read/all', (req: Request, res: Response) => controller.markAllAsRead(req, res));
  router.get('/unread/count', (req: Request, res: Response) => controller.getUnreadCount(req, res));
  router.post('/:id/read', (req: Request, res: Response) => controller.markAsRead(req, res));
  router.delete('/:id', (req: Request, res: Response) => controller.deleteNotification(req, res));

  // Health check
  router.get('/health', (req: Request, res: Response) => res.json({ status: 'ok' }));

  return router;
}