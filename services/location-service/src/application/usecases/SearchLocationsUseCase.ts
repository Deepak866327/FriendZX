import { ILocationRepository } from '../../domain/repositories/ILocationRepository';
import { Logger } from '../../../../../shared/utils/logger';
import { LocationResponseDTO } from '../dto/LocationDTO';

const logger = new Logger('SearchLocationsUseCase');

export class SearchLocationsUseCase {
  constructor(private locationRepository: ILocationRepository) {}

  async execute(
    address: string,
    limit: number = 20
  ): Promise<LocationResponseDTO[]> {
    logger.debug(`Searching locations by address: ${address}`);

    if (!address || address.length < 2) {
      throw new Error('Address must be at least 2 characters');
    }

    const locations = await this.locationRepository.searchByAddress(address, limit);

    return locations.map(location => ({
      userId: location.userId,
      coordinates: {
        latitude: location.coordinates.coordinates[1],
        longitude: location.coordinates.coordinates[0],
      },
      address: location.address,
      accuracy: location.accuracy,
      altitude: location.altitude,
      heading: location.heading,
      speed: location.speed,
      timestamp: location.timestamp,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    }));
  }
}