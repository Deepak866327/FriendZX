import { IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { UserProfile } from '../../domain/entities/UserProfile';
import { Logger } from '../../../../../shared/utils/logger';

const logger = new Logger('SearchUsersUseCase');

export class SearchUsersUseCase {
  constructor(private userProfileRepository: IUserProfileRepository) {}

  async execute(query: string, limit: number = 20): Promise<UserProfile[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    logger.debug(`Searching users for query: "${trimmed}"`);
    return this.userProfileRepository.searchUsers(trimmed, Math.min(limit, 50));
  }

  async discover(limit: number = 20): Promise<UserProfile[]> {
    logger.debug(`Discovering users, limit: ${limit}`);
    return this.userProfileRepository.discoverUsers(Math.min(limit, 50));
  }
}
