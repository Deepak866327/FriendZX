import { INotificationRepository } from '../../domain/repositories/INotificationRepository';
import { Logger } from '../../../../../shared/utils/logger';
import { NotificationListDTO, NotificationResponseDTO } from '../dto/NotificationDTO';
import { Notification } from '../../domain/entities/Notification';

const logger = new Logger('GetNotificationsUseCase');

export class GetNotificationsUseCase {
  constructor(private notificationRepository: INotificationRepository) {}

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.getUnreadCount(userId);
  }

  async execute(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<NotificationListDTO> {
    logger.debug(`Getting notifications for user: ${userId}`);

    const notifications = await this.notificationRepository.findByUserId(userId, limit, offset);
    const unreadCount = await this.notificationRepository.getUnreadCount(userId);

    return {
      notifications: notifications.map(n => this.mapToDTO(n)),
      unreadCount,
      total: notifications.length,
    };
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