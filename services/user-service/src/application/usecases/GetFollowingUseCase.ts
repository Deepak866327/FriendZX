import { IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { Logger } from '../../../../../shared/utils/logger';
import { FollowEntry } from './GetFollowersUseCase';

const logger = new Logger('GetFollowingUseCase');

export class GetFollowingUseCase {
  constructor(private profileRepository: IUserProfileRepository) {}

  async execute(userId: string, limit = 50, offset = 0): Promise<FollowEntry[]> {
    const following = await this.profileRepository.getFollowing(userId, limit, offset);
    const entries = await Promise.all(
      following.map(async f => {
        const profile = await this.profileRepository.findById(f.followingId);
        return {
          userId: f.followingId,
          firstName: profile?.firstName,
          lastName: profile?.lastName,
          bio: profile?.bio,
          photos: profile?.photos || [],
        };
      })
    );
    logger.debug(`Fetched ${entries.length} following for user ${userId}`);
    return entries;
  }
}
