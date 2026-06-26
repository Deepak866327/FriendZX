import { SendNotificationUseCase } from '../usecases/SendNotificationUseCase';
import { Logger } from '../../../../../shared/utils/logger';

const logger = new Logger('LocationEventHandler');

export class LocationEventHandler {
  constructor(private sendNotificationUseCase: SendNotificationUseCase) {}

  async handleLocationUpdated(event: any): Promise<void> {
    try {
      logger.debug(`Processing location.updated event for user: ${event.userId}`);

      // Could send nearby user notifications here
      // When user updates location, notify them of nearby users
    } catch (error) {
      logger.error(`Error handling location updated: ${(error as Error).message}`);
    }
  }

  async handleNearbyUserFound(event: any): Promise<void> {
    try {
      logger.info(`Processing user.nearby.found event for user: ${event.userId}`);

      // Notify user about nearby matches
      if (event.nearbyUsers && event.nearbyUsers.length > 0) {
        await this.sendNotificationUseCase.execute({
          userId: event.userId,
          title: `${event.nearbyUsers.length} Nearby!`,
          message: `There are ${event.nearbyUsers.length} users nearby you!`,
          type: 'nearby_user_found',
          data: {
            nearbyUsersCount: event.nearbyUsers.length,
            distance: event.radius,
            timestamp: event.timestamp,
          },
        });
      }
    } catch (error) {
      logger.error(`Error handling nearby user found: ${(error as Error).message}`);
    }
  }
}