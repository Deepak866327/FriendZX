import { IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { KafkaProducer } from '../../../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../../../shared/utils/logger';
import { UpdateProfileDTO, ProfileResponseDTO } from '../dto/UserDTO';

const logger = new Logger('UpdateProfileUseCase');

export class UpdateProfileUseCase {
  constructor(
    private profileRepository: IUserProfileRepository,
    private kafkaProducer: KafkaProducer
  ) {}

  async execute(userId: string, updateData: UpdateProfileDTO): Promise<ProfileResponseDTO> {
    logger.debug(`Updating profile for user: ${userId}`);

    const profile = await this.profileRepository.update(userId, {
      bio: updateData.bio,
      location: updateData.location,
      interests: updateData.interests,
      photos: updateData.photos,
    });

    // Add activity (non-fatal)
    try {
      await this.profileRepository.addActivity({
        userId,
        activityType: 'profile_update',
        description: 'User updated their profile',
        metadata: { updatedFields: Object.keys(updateData) },
      });
    } catch (activityError) {
      logger.warn(`Failed to add activity: ${(activityError as Error).message}`);
    }

    // Publish Kafka event (non-fatal)
    try {
      await this.kafkaProducer.publish('user.profile.updated', {
        userId,
        changes: updateData,
        timestamp: new Date(),
      });
    } catch (kafkaError) {
      logger.warn(`Failed to publish profile.updated event: ${(kafkaError as Error).message}`);
    }

    logger.info(`Profile updated for user: ${userId}`);

    return {
      id: profile.id,
      userId: profile.userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      bio: profile.bio,
      location: profile.location,
      interests: profile.interests,
      photos: profile.photos,
      followers: profile.followers,
      following: profile.following,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}