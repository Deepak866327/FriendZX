import * as jwt from 'jsonwebtoken';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { KafkaProducer } from '../../../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../../../shared/utils/logger';
import { GoogleAuthDTO, AuthResponseDTO } from '../dto/AuthDTO';

const logger = new Logger('GoogleAuthUseCase');

export class GoogleAuthUseCase {
  constructor(
    private userRepository: IUserRepository,
    private kafkaProducer: KafkaProducer
  ) {}

  async execute(googleData: GoogleAuthDTO): Promise<AuthResponseDTO> {
    logger.debug(`Google auth for: ${googleData.email}`);

    // 1. Find by googleId (returning user)
    let user = await this.userRepository.findByGoogleId(googleData.googleId);

    // 2. Find by email (link existing password account)
    if (!user) {
      const existingByEmail = await this.userRepository.findByEmail(googleData.email);
      if (existingByEmail) {
        user = await this.userRepository.update(existingByEmail.id, { googleId: googleData.googleId });
        logger.info(`Linked Google account to existing user: ${googleData.email}`);
      }
    }

    // 3. Create new OAuth user
    if (!user) {
      user = await this.userRepository.create({
        email: googleData.email,
        password: null,
        firstName: googleData.firstName,
        lastName: googleData.lastName,
        googleId: googleData.googleId,
        profilePicture: googleData.profilePicture,
        isActive: true,
      });

      try {
        await this.kafkaProducer.publish('user.registered', {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          timestamp: new Date(),
        });
      } catch (kafkaError) {
        logger.warn(`Failed to publish user.registered event: ${(kafkaError as Error).message}`);
      }

      logger.info(`New Google user created: ${googleData.email}`);
    }

    await this.userRepository.updateLastLogin(user.id);

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRY || '24h') as any }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d') as any }
    );

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }
}
