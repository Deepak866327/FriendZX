import { Request, Response } from 'express';
import { GetNotificationsUseCase } from '../../application/usecases/GetNotificationsUseCase';
import { MarkAsReadUseCase } from '../../application/usecases/MarkAsReadUseCase';
import { SendNotificationUseCase } from '../../application/usecases/SendNotificationUseCase';
import { Logger } from '../../../../../shared/utils/logger';

const logger = new Logger('NotificationController');

export class NotificationController {
  constructor(
    private getNotificationsUseCase: GetNotificationsUseCase,
    private markAsReadUseCase: MarkAsReadUseCase,
    private sendNotificationUseCase: SendNotificationUseCase
  ) {}

  async getNotifications(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await this.getNotificationsUseCase.execute(userId, limit, offset);
      res.json(result);
    } catch (error) {
      logger.error(`Get notifications error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async markAsRead(req: Request, res: Response) {
    try {
      const notificationId = req.params.id;

      const result = await this.markAsReadUseCase.execute(notificationId);
      res.json(result);
    } catch (error) {
      logger.error(`Mark as read error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      const count = await this.markAsReadUseCase.markAllAsRead(userId);
      res.json({ message: 'All notifications marked as read', count });
    } catch (error) {
      logger.error(`Mark all as read error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const count = await this.getNotificationsUseCase.getUnreadCount(userId);
      res.json({ count });
    } catch (error) {
      logger.error(`Get unread count error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async deleteNotification(req: Request, res: Response) {
    try {
      const notificationId = req.params.id;
      const success = await this.markAsReadUseCase.delete(notificationId);
      if (!success) return res.status(404).json({ error: 'Notification not found' });
      res.json({ message: 'Notification deleted' });
    } catch (error) {
      logger.error(`Delete notification error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }
}