import { Pool, QueryResult } from 'pg';
import * as bcrypt from 'bcryptjs';
import { RedisCache } from '../../../../../../shared/utils/RedisCache';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { User } from '../../../domain/entities/User';
import { Logger } from '../../../../../../shared/utils/logger';

const logger = new Logger('PostgresUserRepository');

const SELECT_COLS = 'id, email, password, first_name, last_name, username, phone_number, google_id, profile_picture, phone, is_active, is_verified, last_login, created_at, updated_at';

export class PostgresUserRepository implements IUserRepository {
  constructor(
    private db: Pool,
    private redis: RedisCache
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    try {
      const cacheKey = `user:email:${email}`;

      const cached = await this.redis.get<User>(cacheKey);
      if (cached) {
        logger.debug(`User found in cache: ${email}`);
        return cached;
      }

      const result: QueryResult = await this.db.query(
        `SELECT ${SELECT_COLS} FROM users WHERE email = $1`,
        [email]
      );

      if (result.rows.length === 0) return null;

      const user = this.mapToUser(result.rows[0]);
      await this.redis.set(cacheKey, user, 3600);
      return user;
    } catch (error) {
      logger.error(`Error finding user by email: ${(error as Error).message}`);
      return null;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const cacheKey = `user:id:${id}`;

      const cached = await this.redis.get<User>(cacheKey);
      if (cached) {
        logger.debug(`User found in cache by ID: ${id}`);
        return cached;
      }

      const result: QueryResult = await this.db.query(
        `SELECT ${SELECT_COLS} FROM users WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) return null;

      const user = this.mapToUser(result.rows[0]);
      await this.redis.set(cacheKey, user, 3600);
      return user;
    } catch (error) {
      logger.error(`Error finding user by ID: ${(error as Error).message}`);
      return null;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      const result: QueryResult = await this.db.query(
        `SELECT ${SELECT_COLS} FROM users WHERE username = $1`,
        [username.toLowerCase()]
      );
      if (result.rows.length === 0) return null;
      return this.mapToUser(result.rows[0]);
    } catch (error) {
      logger.error(`Error finding user by username: ${(error as Error).message}`);
      return null;
    }
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    try {
      const result: QueryResult = await this.db.query(
        `SELECT ${SELECT_COLS} FROM users WHERE google_id = $1`,
        [googleId]
      );

      if (result.rows.length === 0) return null;
      return this.mapToUser(result.rows[0]);
    } catch (error) {
      logger.error(`Error finding user by Google ID: ${(error as Error).message}`);
      return null;
    }
  }

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    try {
      const hashedPassword = userData.password
        ? await bcrypt.hash(userData.password, 10)
        : null;

      const result: QueryResult = await this.db.query(
        `INSERT INTO users (email, password, first_name, last_name, username, phone_number, google_id, profile_picture, is_active, is_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING ${SELECT_COLS}`,
        [
          userData.email,
          hashedPassword,
          userData.firstName,
          userData.lastName,
          userData.username ? userData.username.toLowerCase() : null,
          userData.phoneNumber || null,
          userData.googleId || null,
          userData.profilePicture || null,
          true,
          true, // OTP was verified before calling create
        ]
      );

      const user = this.mapToUser(result.rows[0]);
      await this.redis.set(`user:email:${user.email}`, user, 3600);
      await this.redis.set(`user:id:${user.id}`, user, 3600);

      logger.info(`User created: ${user.email}`);
      return user;
    } catch (error) {
      logger.error(`Error creating user: ${(error as Error).message}`);
      throw error;
    }
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (userData.email) {
        fields.push(`email = $${paramCount++}`);
        values.push(userData.email);
      }
      if (userData.firstName) {
        fields.push(`first_name = $${paramCount++}`);
        values.push(userData.firstName);
      }
      if (userData.lastName) {
        fields.push(`last_name = $${paramCount++}`);
        values.push(userData.lastName);
      }
      if (userData.googleId !== undefined) {
        fields.push(`google_id = $${paramCount++}`);
        values.push(userData.googleId);
      }
      if (userData.profilePicture) {
        fields.push(`profile_picture = $${paramCount++}`);
        values.push(userData.profilePicture);
      }
      if (userData.phone) {
        fields.push(`phone = $${paramCount++}`);
        values.push(userData.phone);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result: QueryResult = await this.db.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}
         RETURNING ${SELECT_COLS}`,
        values
      );

      const user = this.mapToUser(result.rows[0]);
      await this.redis.del(`user:id:${id}`);
      await this.redis.del(`user:email:${user.email}`);

      logger.info(`User updated: ${id}`);
      return user;
    } catch (error) {
      logger.error(`Error updating user: ${(error as Error).message}`);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const user = await this.findById(id);
      if (!user) return false;

      await this.db.query('DELETE FROM users WHERE id = $1', [id]);
      await this.redis.del(`user:id:${id}`);
      await this.redis.del(`user:email:${user.email}`);

      logger.info(`User deleted: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting user: ${(error as Error).message}`);
      return false;
    }
  }

  async updatePassword(id: string, newPasswordHash: string): Promise<void> {
    try {
      const emailResult = await this.db.query('SELECT email FROM users WHERE id = $1', [id]);
      await this.db.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [newPasswordHash, id]);
      await this.redis.del(`user:id:${id}`);
      if (emailResult.rows[0]) await this.redis.del(`user:email:${emailResult.rows[0].email}`);
      logger.info(`Password updated for user: ${id}`);
    } catch (error) {
      logger.error(`Error updating password: ${(error as Error).message}`);
      throw error;
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    try {
      await this.db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [id]);
      await this.redis.del(`user:id:${id}`);
      logger.debug(`Last login updated for user: ${id}`);
    } catch (error) {
      logger.error(`Error updating last login: ${(error as Error).message}`);
    }
  }

  private mapToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username || undefined,
      phoneNumber: row.phone_number || undefined,
      googleId: row.google_id || undefined,
      profilePicture: row.profile_picture,
      phone: row.phone,
      isActive: row.is_active,
      isVerified: row.is_verified ?? false,
      lastLogin: row.last_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
