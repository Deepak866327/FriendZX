import { INotificationRepository } from '../../domain/repositories/INotificationRepository';
import { Logger } from '../../../../../shared/utils/logger';
import { NotificationResponseDTO } from '../dto/NotificationDTO';
import { Notification } from '../../domain/entities/Notification';

const logger = new Logger('MarkAsReadUseCase');

export class MarkAsReadUseCase {
  constructor(private notificationRepository: INotificationRepository) {}

  async execute(notificationId: string): Promise<NotificationResponseDTO> {
    logger.debug(`Marking notification as read: ${notificationId}`);

    const updated = await this.notificationRepository.markAsRead(notificationId);

    logger.info(`Notification marked as read: ${notificationId}`);

    return this.mapToDTO(updated);
  }

  async delete(notificationId: string): Promise<boolean> {
    logger.debug(`Deleting notification: ${notificationId}`);
    const success = await this.notificationRepository.delete(notificationId);
    if (success) logger.info(`Notification deleted: ${notificationId}`);
    return success;
  }

  async markAllAsRead(userId: string): Promise<number> {
    logger.debug(`Marking all notifications as read for user: ${userId}`);

    const count = await this.notificationRepository.markAllAsRead(userId);

    logger.info(`Marked ${count} notifications as read for user: ${userId}`);

    return count;
  }

  private mapToDTO(notification: Notification): NotificationResponseDTO {
    return {
      id: notification.id,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      data: notification.data,
      read: notification.read,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}