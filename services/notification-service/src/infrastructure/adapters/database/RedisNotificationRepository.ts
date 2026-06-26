import Redis from 'ioredis';
import { INotificationRepository } from '../../../domain/repositories/INotificationRepository';
import { Notification, NotificationType } from '../../../domain/entities/Notification';
import { Logger } from '../../../../../../shared/utils/logger';
import { randomUUID } from 'crypto';

const logger = new Logger('RedisNotificationRepository');

export class RedisNotificationRepository implements INotificationRepository {
  private redis: Redis;

  constructor(redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.redis = new Redis(redisUrl);
  }

  async create(
    notificationData: Omit<Notification, 'id' | 'createdAt'>
  ): Promise<Notification> {
    try {
      const id = randomUUID();
      const notification: Notification = {
        id,
        ...notificationData,
        createdAt: new Date(),
      };

      const key = `notification:${id}`;
      const userKey = `user:${notificationData.userId}:notifications`;
      const ttl = process.env.NOTIFICATION_TTL ? parseInt(process.env.NOTIFICATION_TTL) : 2592000;

      // Store notification
      await this.redis.setex(key, ttl, JSON.stringify(notification));

      // Add to user's notification list
      await this.redis.lpush(userKey, id);

      // Keep only the latest MAX_NOTIFICATIONS_PER_USER
      const maxNotifications = parseInt(process.env.MAX_NOTIFICATIONS_PER_USER || '100');
      await this.redis.ltrim(userKey, 0, maxNotifications - 1);

      logger.info(`Notification created: ${id} for user: ${notificationData.userId}`);
      return notification;
    } catch (error) {
      logger.error(`Error creating notification: ${(error as Error).message}`);
      throw error;
    }
  }

  async findById(id: string): Promise<Notification | null> {
    try {
      const key = `notification:${id}`;
      const data = await this.redis.get(key);

      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Error finding notification: ${(error as Error).message}`);
      return null;
    }
  }

  async findByUserId(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    try {
      const userKey = `user:${userId}:notifications`;

      // Get notification IDs
      const notificationIds = await this.redis.lrange(userKey, offset, offset + limit - 1);

      if (notificationIds.length === 0) {
        return [];
      }

      // Get notification data
      const notifications: Notification[] = [];

      for (const id of notificationIds) {
        const notification = await this.findById(id);
        if (notification) {
          notifications.push(notification);
        }
      }

      return notifications;
    } catch (error) {
      logger.error(`Error finding notifications by user: ${(error as Error).message}`);
      return [];
    }
  }

  async update(id: string, notificationData: Partial<Notification>): Promise<Notification> {
    try {
      const existing = await this.findById(id);

      if (!existing) {
        throw new Error('Notification not found');
      }

      const updated: Notification = {
        ...existing,
        ...notificationData,
      };

      const key = `notification:${id}`;
      const ttl = process.env.NOTIFICATION_TTL ? parseInt(process.env.NOTIFICATION_TTL) : 2592000;

      await this.redis.setex(key, ttl, JSON.stringify(updated));

      logger.info(`Notification updated: ${id}`);
      return updated;
    } catch (error) {
      logger.error(`Error updating notification: ${(error as Error).message}`);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const notification = await this.findById(id);

      if (!notification) {
        return false;
      }

      const key = `notification:${id}`;
      const userKey = `user:${notification.userId}:notifications`;

      await this.redis.del(key);
      await this.redis.lrem(userKey, 0, id);

      logger.info(`Notification deleted: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting notification: ${(error as Error).message}`);
      return false;
    }
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    try {
      const userKey = `user:${userId}:notifications`;

      // Get all notification IDs
      const notificationIds = await this.redis.lrange(userKey, 0, -1);

      // Delete all notifications
      for (const id of notificationIds) {
        await this.delete(id);
      }

      await this.redis.del(userKey);

      logger.info(`All notifications deleted for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting user notifications: ${(error as Error).message}`);
      return false;
    }
  }

  async markAsRead(id: string): Promise<Notification> {
    try {
      const notification = await this.findById(id);

      if (!notification) {
        throw new Error('Notification not found');
      }

      const updated = await this.update(id, {
        read: true,
        readAt: new Date(),
      });

      logger.debug(`Notification marked as read: ${id}`);
      return updated;
    } catch (error) {
      logger.error(`Error marking as read: ${(error as Error).message}`);
      throw error;
    }
  }

  async markAllAsRead(userId: string): Promise<number> {
    try {
      const notifications = await this.findByUserId(userId, 1000, 0);
      let count = 0;

      for (const notification of notifications) {
        if (!notification.read) {
          await this.markAsRead(notification.id);
          count++;
        }
      }

      logger.info(`Marked ${count} notifications as read for user: ${userId}`);
      return count;
    } catch (error) {
      logger.error(`Error marking all as read: ${(error as Error).message}`);
      return 0;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const notifications = await this.findByUserId(userId, 1000, 0);
      const unreadCount = notifications.filter(n => !n.read).length;

      return unreadCount;
    } catch (error) {
      logger.error(`Error getting unread count: ${(error as Error).message}`);
      return 0;
    }
  }

  async createBatch(
    notificationsData: Omit<Notification, 'id' | 'createdAt'>[]
  ): Promise<Notification[]> {
    try {
      const notifications: Notification[] = [];

      for (const data of notificationsData) {
        const notification = await this.create(data);
        notifications.push(notification);
      }

      logger.info(`Created batch of ${notifications.length} notifications`);
      return notifications;
    } catch (error) {
      logger.error(`Error creating batch notifications: ${(error as Error).message}`);
      throw error;
    }
  }

  async trackSocket(userId: string, socketId: string): Promise<void> {
    try {
      const key = `user:${userId}:sockets`;
      await this.redis.sadd(key, socketId);
      await this.redis.expire(key, 86400); // 24 hour expiry

      logger.debug(`Socket tracked for user ${userId}: ${socketId}`);
    } catch (error) {
      logger.error(`Error tracking socket: ${(error as Error).message}`);
    }
  }

  async removeSocket(socketId: string): Promise<void> {
    try {
      // Find user associated with this socket
      const pattern = `user:*:sockets`;
      const keys = await this.redis.keys(pattern);

      for (const key of keys) {
        await this.redis.srem(key, socketId);
      }

      logger.debug(`Socket removed: ${socketId}`);
    } catch (error) {
      logger.error(`Error removing socket: ${(error as Error).message}`);
    }
  }

  async getSocketsByUserId(userId: string): Promise<string[]> {
    try {
      const key = `user:${userId}:sockets`;
      const sockets = await this.redis.smembers(key);

      return sockets;
    } catch (error) {
      logger.error(`Error getting sockets: ${(error as Error).message}`);
      return [];
    }
  }

  async getAllActiveSockets(): Promise<Map<string, string[]>> {
    try {
      const pattern = `user:*:sockets`;
      const keys = await this.redis.keys(pattern);
      const map = new Map<string, string[]>();

      for (const key of keys) {
        const userId = key.match(/user:(.+?):sockets/)?.[1];
        if (userId) {
          const sockets = await this.redis.smembers(key);
          if (sockets.length > 0) {
            map.set(userId, sockets);
          }
        }
      }

      return map;
    } catch (error) {
      logger.error(`Error getting all active sockets: ${(error as Error).message}`);
      return new Map();
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      logger.info('Redis notification repository disconnected');
    } catch (error) {
      logger.error(`Error disconnecting: ${(error as Error).message}`);
    }
  }
}
