import { IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';
import { Logger } from '../../../../../shared/utils/logger';
import { ProfileResponseDTO } from '../dto/UserDTO';

const logger = new Logger('GetProfileUseCase');

export class GetProfileUseCase {
  constructor(private profileRepository: IUserProfileRepository) {}

  async execute(userId: string): Promise<ProfileResponseDTO> {
    logger.debug(`Getting profile for user: ${userId}`);

    let profile = await this.profileRepository.findById(userId);

    if (!profile) {
      logger.info(`Profile not found for user ${userId}, creating default profile`);
      profile = await this.profileRepository.create({
        userId,
        bio: '',
        location: '',
        interests: [],
        photos: [],
        followers: 0,
        following: 0,
      });
    }

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