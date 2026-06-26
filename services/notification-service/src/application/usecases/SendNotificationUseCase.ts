import { INotificationRepository } from '../../domain/repositories/INotificationRepository';
import { Logger } from '../../../../../shared/utils/logger';
import { CreateNotificationDTO, NotificationResponseDTO } from '../dto/NotificationDTO';
import { Notification } from '../../domain/entities/Notification';

const logger = new Logger('SendNotificationUseCase');

export class SendNotificationUseCase {
  constructor(private notificationRepository: INotificationRepository) {}

  async execute(notificationData: CreateNotificationDTO): Promise<NotificationResponseDTO> {
    logger.debug(`Sending notification to user: ${notificationData.userId}`);

    const notification: Omit<Notification, 'id' | 'createdAt'> = {
      userId: notificationData.userId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type as any,
      data: notificationData.data,
      read: false,
    };

    const created = await this.notificationRepository.create(notification);

    logger.info(`Notification sent to user: ${notificationData.userId}`);

    return this.mapToDTO(created);
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