import * as bcrypt from 'bcryptjs';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { Logger } from '../../../../../shared/utils/logger';

const logger = new Logger('ChangePasswordUseCase');

export class ChangePasswordUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('User not found');

    if (!user.password) {
      throw new Error('This account uses Google sign-in and does not have a password.');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new Error('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userRepository.updatePassword(userId, hashed);
    logger.info(`Password changed for user: ${userId}`);
  }
}
