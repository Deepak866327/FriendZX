import { IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { KafkaProducer } from '../../../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../../../shared/utils/logger';
import { FollowResponseDTO } from '../dto/UserDTO';

const logger = new Logger('FollowUserUseCase');

export class FollowUserUseCase {
  constructor(
    private profileRepository: IUserProfileRepository,
    private kafkaProducer: KafkaProducer
  ) {}

  async execute(userId: string, followerId: string): Promise<FollowResponseDTO> {
    logger.debug(`User ${followerId} following user ${userId}`);

    if (userId === followerId) {
      throw new Error('Cannot follow yourself');
    }

    await this.profileRepository.follow(userId, followerId);

    // Add activity
    await this.profileRepository.addActivity({
      userId: followerId,
      activityType: 'follow',
      description: `Started following user ${userId}`,
      metadata: { followedUserId: userId },
    });

    // Look up follower profile for notification
    let followerFirstName: string | undefined;
    let followerLastName: string | undefined;
    let followerUsername: string | undefined;
    try {
      const followerProfile = await this.profileRepository.findById(followerId);
      followerFirstName = followerProfile?.firstName;
      followerLastName  = followerProfile?.lastName;
      followerUsername  = (followerProfile as any)?.username;
    } catch (_) {}

    // Publish Kafka event
    await this.kafkaProducer.publish('user.followed', {
      userId,
      followerId,
      followerFirstName,
      followerLastName,
      followerUsername,
      timestamp: new Date(),
    });

    logger.info(`User ${followerId} followed user ${userId}`);

    return {
      userId,
      followerId,
      isFollowing: true,
      message: 'User followed successfully',
    };
  }
}