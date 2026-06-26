import { IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { Logger } from '../../../../../shared/utils/logger';
import { ActivityResponseDTO } from '../dto/UserDTO';

const logger = new Logger('GetActivityUseCase');

export class GetActivityUseCase {
  constructor(private profileRepository: IUserProfileRepository) {}

  async execute(userId: string, limit: number = 20, offset: number = 0): Promise<ActivityResponseDTO[]> {
    logger.debug(`Getting activity for user: ${userId}`);

    const activities = await this.profileRepository.getActivity(userId, limit, offset);

    return activities.map(activity => ({
      id: activity.id,
      userId: activity.userId,
      activityType: activity.activityType,
      description: activity.description,
      metadata: activity.metadata,
      createdAt: activity.createdAt,
    }));
  }
}