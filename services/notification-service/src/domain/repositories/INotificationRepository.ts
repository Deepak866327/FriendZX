import { Notification } from '../entities/Notification';

export interface INotificationRepository {
  // Notification operations
  create(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<Notification[]>;
  update(id: string, notification: Partial<Notification>): Promise<Notification>;
  delete(id: string): Promise<boolean>;
  deleteByUserId(userId: string): Promise<boolean>;

  // Read operations
  markAsRead(id: string): Promise<Notification>;
  markAllAsRead(userId: string): Promise<number>;
  getUnreadCount(userId: string): Promise<number>;

  // Batch operations
  createBatch(notifications: Omit<Notification, 'id' | 'createdAt'>[]): Promise<Notification[]>;

  // Socket tracking
  trackSocket(userId: string, socketId: string): Promise<void>;
  removeSocket(socketId: string): Promise<void>;
  getSocketsByUserId(userId: string): Promise<string[]>;
  getAllActiveSockets(): Promise<Map<string, string[]>>;
}