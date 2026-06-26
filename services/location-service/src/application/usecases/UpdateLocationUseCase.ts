import { ILocationRepository } from '../../domain/repositories/ILocationRepository';
import { KafkaProducer } from '../../../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../../../shared/utils/logger';
import { UpdateLocationDTO, LocationResponseDTO } from '../dto/LocationDTO';
import { Location } from '../../domain/entities/Location';

const logger = new Logger('UpdateLocationUseCase');

export class UpdateLocationUseCase {
  constructor(
    private locationRepository: ILocationRepository,
    private kafkaProducer: KafkaProducer
  ) {}

  async execute(userId: string, locationData: UpdateLocationDTO): Promise<LocationResponseDTO> {
    logger.debug(`Updating location for user: ${userId}`);

    if (locationData.latitude < -90 || locationData.latitude > 90) {
      throw new Error('Invalid latitude');
    }

    if (locationData.longitude < -180 || locationData.longitude > 180) {
      throw new Error('Invalid longitude');
    }

    const location: Location = {
      userId,
      coordinates: {
        type: 'Point',
        coordinates: [locationData.longitude, locationData.latitude],
      },
      address: locationData.address,
      accuracy: locationData.accuracy,
      altitude: locationData.altitude,
      heading: locationData.heading,
      speed: locationData.speed,
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedLocation = await this.locationRepository.updateLocation(location);

    // Publish Kafka event
    await this.kafkaProducer.publish('location.updated', {
      userId,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      address: locationData.address,
      timestamp: new Date(),
    });

    logger.info(`Location updated for user: ${userId}`);

    return this.mapToDTO(updatedLocation);
  }

  private mapToDTO(location: Location): LocationResponseDTO {
    return {
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
    };
  }
}