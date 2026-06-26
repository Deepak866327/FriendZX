import { User, UserCredentials } from '../entities/User';

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
  delete(id: string): Promise<boolean>;
  updateLastLogin(id: string): Promise<void>;
  updatePassword(id: string, newPasswordHash: string): Promise<void>;
}