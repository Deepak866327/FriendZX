import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { KafkaProducer } from '../../../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../../../shared/utils/logger';
import { RegisterDTO, AuthResponseDTO } from '../dto/AuthDTO';

const logger = new Logger('RegisterUseCase');

export class RegisterUseCase {
  constructor(
    private userRepository: IUserRepository,
    private kafkaProducer: KafkaProducer
  ) {}

  async execute(registerData: RegisterDTO): Promise<AuthResponseDTO> {
    logger.debug(`Registration attempt for email: ${registerData.email}`);

    const existingUser = await this.userRepository.findByEmail(registerData.email);
    if (existingUser) throw new Error('Email already registered');

    if (registerData.username) {
      const existingUsername = await this.userRepository.findByUsername(registerData.username);
      if (existingUsername) throw new Error('Username already taken');
    }

    const user = await this.userRepository.create({
      email: registerData.email,
      password: registerData.password,
      firstName: registerData.firstName,
      lastName: registerData.lastName,
      username: registerData.username,
      phoneNumber: registerData.phoneNumber,
      isActive: true,
    });

    try {
      await this.kafkaProducer.publish('user.registered', {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        timestamp: new Date(),
      });
    } catch (kafkaError) {
      logger.warn(`Failed to publish user.registered event: ${(kafkaError as Error).message}`);
    }

    logger.info(`User registered: ${user.email} (@${user.username})`);

    const token = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
    };
  }

  private generateAccessToken(user: any): string {
    return jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRY || '24h') as any }
    );
  }

  private generateRefreshToken(user: any): string {
    return jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d') as any }
    );
  }
}
