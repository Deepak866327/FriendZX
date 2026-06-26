import { IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { KafkaProducer } from '../../../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../../../shared/utils/logger';
import { FollowResponseDTO } from '../dto/UserDTO';

const logger = new Logger('UnfollowUserUseCase');

export class UnfollowUserUseCase {
  constructor(
    private profileRepository: IUserProfileRepository,
    private kafkaProducer: KafkaProducer
  ) {}

  async execute(userId: string, followerId: string): Promise<FollowResponseDTO> {
    logger.debug(`User ${followerId} unfollowing user ${userId}`);

    const success = await this.profileRepository.unfollow(userId, followerId);

    if (!success) {
      throw new Error('User was not being followed');
    }

    // Add activity
    await this.profileRepository.addActivity({
      userId: followerId,
      activityType: 'unfollow',
      description: `Stopped following user ${userId}`,
      metadata: { unfollowedUserId: userId },
    });

    // Publish Kafka event
    await this.kafkaProducer.publish('user.unfollowed', {
      userId,
      followerId,
      timestamp: new Date(),
    });

    logger.info(`User ${followerId} unfollowed user ${userId}`);

    return {
      userId,
      followerId,
      isFollowing: false,
      message: 'User unfollowed successfully',
    };
  }
}