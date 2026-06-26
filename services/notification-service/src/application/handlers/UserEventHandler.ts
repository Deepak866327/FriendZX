import { SendNotificationUseCase } from '../usecases/SendNotificationUseCase';
import { Logger } from '../../../../../shared/utils/logger';

const logger = new Logger('UserEventHandler');

export class UserEventHandler {
  constructor(private sendNotificationUseCase: SendNotificationUseCase) {}

  async handleUserRegistered(event: any): Promise<void> {
    try {
      logger.info(`Processing user.registered event for user: ${event.userId}`);

      // Send welcome notification
      await this.sendNotificationUseCase.execute({
        userId: event.userId,
        title: 'Welcome!',
        message: 'Welcome to our platform! Start exploring and connecting with others.',
        type: 'user_registered',
        data: { userId: event.userId },
      });
    } catch (error) {
      logger.error(`Error handling user registered: ${(error as Error).message}`);
    }
  }

  async handleUserLoggedIn(event: any): Promise<void> {
    try {
      logger.debug(`Processing user.logged-in event for user: ${event.userId}`);
      // Could send activity notifications here
    } catch (error) {
      logger.error(`Error handling user logged in: ${(error as Error).message}`);
    }
  }

  async handleUserDeleted(event: any): Promise<void> {
    try {
      logger.info(`Processing user.deleted event for user: ${event.userId}`);

      // Delete all notifications for this user
      // This would be handled by the service cleanup
    } catch (error) {
      logger.error(`Error handling user deleted: ${(error as Error).message}`);
    }
  }
}