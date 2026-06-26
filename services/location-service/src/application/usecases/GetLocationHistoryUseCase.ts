import { ILocationRepository } from '../../domain/repositories/ILocationRepository';
import { Logger } from '../../../../../shared/utils/logger';
import { LocationHistoryDTO } from '../dto/LocationDTO';

const logger = new Logger('GetLocationHistoryUseCase');

export class GetLocationHistoryUseCase {
  constructor(private locationRepository: ILocationRepository) {}

  async execute(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<LocationHistoryDTO[]> {
    logger.debug(`Getting location history for user: ${userId}`);

    if (limit < 1 || limit > 1000) {
      limit = Math.min(Math.max(limit, 1), 1000);
    }

    if (offset < 0) {
      offset = 0;
    }

    const history = await this.locationRepository.getLocationHistory(userId, limit, offset);

    return history.map(entry => ({
      coordinates: {
        latitude: entry.coordinates.coordinates[1],
        longitude: entry.coordinates.coordinates[0],
      },
      address: entry.address,
      timestamp: entry.timestamp,
    }));
  }
}