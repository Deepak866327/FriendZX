import { IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { Logger } from '../../../../../shared/utils/logger';

const logger = new Logger('GetFollowersUseCase');

export interface FollowEntry {
  userId: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  photos: string[];
}

export class GetFollowersUseCase {
  constructor(private profileRepository: IUserProfileRepository) {}

  async execute(userId: string, limit = 50, offset = 0): Promise<FollowEntry[]> {
    const followers = await this.profileRepository.getFollowers(userId, limit, offset);
    const entries = await Promise.all(
      followers.map(async f => {
        const profile = await this.profileRepository.findById(f.followerId);
        return {
          userId: f.followerId,
          firstName: profile?.firstName,
          lastName: profile?.lastName,
          bio: profile?.bio,
          photos: profile?.photos || [],
        };
      })
    );
    logger.debug(`Fetched ${entries.length} followers for user ${userId}`);
    return entries;
  }
}
