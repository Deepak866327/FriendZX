import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { KafkaProducer } from '../../../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../../../shared/utils/logger';
import { LoginDTO, AuthResponseDTO } from '../dto/AuthDTO';

const logger = new Logger('LoginUseCase');

export class LoginUseCase {
  constructor(
    private userRepository: IUserRepository,
    private kafkaProducer: KafkaProducer,
  ) {}

  async execute(loginData: LoginDTO): Promise<AuthResponseDTO> {
    const { identifier, password } = loginData;
    logger.debug(`Login attempt for identifier: ${identifier}`);

    // Resolve by email first, then fall back to username
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    let user = isEmail
      ? await this.userRepository.findByEmail(identifier)
      : await this.userRepository.findByUsername(identifier);

    // If email lookup returned nothing, try username as well (handles edge case)
    if (!user && isEmail) {
      user = await this.userRepository.findByUsername(identifier);
    }

    if (!user) {
      logger.warn(`Login failed - not found: ${identifier}`);
      throw new Error('Invalid credentials');
    }

    if (!user.password) {
      logger.warn(`Login failed - Google-only account: ${identifier}`);
      throw new Error('This account uses Google sign-in. Please continue with Google.');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      logger.warn(`Login failed - wrong password: ${identifier}`);
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      logger.warn(`Login failed - inactive account: ${identifier}`);
      throw new Error('User account is inactive');
    }

    await this.userRepository.updateLastLogin(user.id);

    try {
      await this.kafkaProducer.publish('user.logged-in', {
        userId: user.id, email: user.email, timestamp: new Date(),
      });
    } catch (e) {
      logger.warn(`Failed to publish user.logged-in: ${(e as Error).message}`);
    }

    logger.info(`User logged in: ${user.email}`);

    return {
      token:        this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
      user: {
        id: user.id, email: user.email,
        firstName: user.firstName, lastName: user.lastName,
      },
    };
  }

  private generateAccessToken(user: any): string {
    return jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRY || '24h') as any },
    );
  }

  private generateRefreshToken(user: any): string {
    return jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d') as any },
    );
  }
}
