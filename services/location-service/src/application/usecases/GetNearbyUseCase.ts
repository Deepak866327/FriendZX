import { ILocationRepository } from '../../domain/repositories/ILocationRepository';
import { Logger } from '../../../../../shared/utils/logger';
import { NearbyUserDTO } from '../dto/LocationDTO';

const logger = new Logger('GetNearbyUseCase');

export class GetNearbyUseCase {
  constructor(private locationRepository: ILocationRepository) {}

  async execute(
    userId: string,
    radiusMeters: number = 200,
    limit: number = 50
  ): Promise<NearbyUserDTO[]> {
    logger.debug(`Finding nearby users for user: ${userId}`);

    if (radiusMeters < 10 || radiusMeters > 50000) {
      throw new Error('Radius must be between 10 and 50000 meters');
    }

    const nearbyUsers = await this.locationRepository.findNearbyUsers(userId, radiusMeters);

    return nearbyUsers
      .filter(user => user.userId !== userId) // Exclude self
      .slice(0, limit)
      .map(user => ({
        userId: user.userId,
        distance: user.distance,
        coordinates: {
          latitude: user.coordinates.coordinates[1],
          longitude: user.coordinates.coordinates[0],
        },
        address: user.address,
        lastUpdated: user.lastUpdated,
      }));
  }
}