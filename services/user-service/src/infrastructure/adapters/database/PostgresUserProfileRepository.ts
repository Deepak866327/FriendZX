import { Pool, QueryResult } from 'pg';
import { RedisCache } from '../../../../../../shared/utils/RedisCache';
import { IUserProfileRepository } from '../../../domain/repositories/IUserProfileRepository';
import { UserProfile, UserActivity, UserFollower, FollowingUser } from '../../../domain/entities/UserProfile';
import { Logger } from '../../../../../../shared/utils/logger';

const logger = new Logger('PostgresUserProfileRepository');

export class PostgresUserProfileRepository implements IUserProfileRepository {
  constructor(
    private db: Pool,
    private redis: RedisCache
  ) {}

  async findById(userId: string): Promise<UserProfile | null> {
    try {
      const cacheKey = `profile:${userId}`;

      // Check Redis cache
      const cached = await this.redis.get<UserProfile>(cacheKey);
      if (cached) {
        logger.debug(`Profile found in cache: ${userId}`);
        return cached;
      }

      const result: QueryResult = await this.db.query(
        'SELECT id, user_id, first_name, last_name, username, bio, location, interests, photos, followers, following, friends, created_at, updated_at FROM user_profiles WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const profile = this.mapToProfile(result.rows[0]);
      await this.redis.set(cacheKey, profile, 3600);

      return profile;
    } catch (error) {
      logger.error(`Error finding profile: ${(error as Error).message}`);
      return null;
    }
  }

  async create(profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
    try {
      const result: QueryResult = await this.db.query(
        `INSERT INTO user_profiles (user_id, first_name, last_name, username, bio, location, interests, photos, followers, following, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING id, user_id, first_name, last_name, username, bio, location, interests, photos, followers, following, friends, created_at, updated_at`,
        [
          profileData.userId,
          profileData.firstName || null,
          profileData.lastName || null,
          (profileData as any).username || null,
          profileData.bio || null,
          profileData.location || null,
          profileData.interests || [],
          profileData.photos || [],
          0,
          0,
        ]
      );

      const profile = this.mapToProfile(result.rows[0]);
      await this.redis.set(`profile:${profile.userId}`, profile, 3600);

      logger.info(`Profile created for user: ${profileData.userId}`);
      return profile;
    } catch (error) {
      logger.error(`Error creating profile: ${(error as Error).message}`);
      throw error;
    }
  }

  async update(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (profileData.bio !== undefined) {
        fields.push(`bio = $${paramCount++}`);
        values.push(profileData.bio);
      }
      if (profileData.location !== undefined) {
        fields.push(`location = $${paramCount++}`);
        values.push(profileData.location);
      }
      if (profileData.interests) {
        fields.push(`interests = $${paramCount++}`);
        values.push(profileData.interests);
      }
      if (profileData.photos) {
        fields.push(`photos = $${paramCount++}`);
        values.push(profileData.photos);
      }

      fields.push(`updated_at = NOW()`);
      values.push(userId);

      const result: QueryResult = await this.db.query(
        `UPDATE user_profiles SET ${fields.join(', ')} WHERE user_id = $${paramCount}
         RETURNING id, user_id, first_name, last_name, username, bio, location, interests, photos, followers, following, friends, created_at, updated_at`,
        values
      );

      const profile = this.mapToProfile(result.rows[0]);
      await this.redis.del(`profile:${userId}`);

      logger.info(`Profile updated for user: ${userId}`);
      return profile;
    } catch (error) {
      logger.error(`Error updating profile: ${(error as Error).message}`);
      throw error;
    }
  }

  async delete(userId: string): Promise<boolean> {
    try {
      await this.db.query('DELETE FROM user_profiles WHERE user_id = $1', [userId]);
      await this.redis.del(`profile:${userId}`);

      logger.info(`Profile deleted for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting profile: ${(error as Error).message}`);
      return false;
    }
  }

  async getActivity(userId: string, limit: number = 20, offset: number = 0): Promise<UserActivity[]> {
    try {
      const result: QueryResult = await this.db.query(
        'SELECT id, user_id, activity_type, description, metadata, created_at FROM user_activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
      );

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        activityType: row.activity_type,
        description: row.description,
        metadata: row.metadata ?? undefined,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error(`Error getting activity: ${(error as Error).message}`);
      return [];
    }
  }

  async addActivity(activityData: Omit<UserActivity, 'id' | 'createdAt'>): Promise<UserActivity> {
    try {
      const result: QueryResult = await this.db.query(
        `INSERT INTO user_activities (user_id, activity_type, description, metadata, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, user_id, activity_type, description, metadata, created_at`,
        [
          activityData.userId,
          activityData.activityType,
          activityData.description,
          activityData.metadata ? JSON.stringify(activityData.metadata) : null,
        ]
      );

      const activity = result.rows[0];
      // pg auto-parses JSONB columns into JS objects — do NOT call JSON.parse
      return {
        id: activity.id,
        userId: activity.user_id,
        activityType: activity.activity_type,
        description: activity.description,
        metadata: activity.metadata ?? undefined,
        createdAt: activity.created_at,
      };
    } catch (error) {
      logger.error(`Error adding activity: ${(error as Error).message}`);
      throw error;
    }
  }

  async follow(userId: string, followerId: string): Promise<UserFollower> {
    try {
      // Check if already following
      const existing = await this.isFollowing(userId, followerId);
      if (existing) {
        throw new Error('Already following this user');
      }

      const result: QueryResult = await this.db.query(
        `INSERT INTO user_followers (user_id, follower_id, created_at)
         VALUES ($1, $2, NOW())
         RETURNING id, user_id, follower_id, created_at`,
        [userId, followerId]
      );

      // Update follower count
      await this.db.query(
        'UPDATE user_profiles SET followers = followers + 1 WHERE user_id = $1',
        [userId]
      );

      // Update following count
      await this.db.query(
        'UPDATE user_profiles SET following = following + 1 WHERE user_id = $1',
        [followerId]
      );

      // If mutual follow (userId also follows followerId) → both become friends
      const isMutual = await this.isFollowing(followerId, userId);
      if (isMutual) {
        await this.db.query(
          'UPDATE user_profiles SET friends = friends + 1 WHERE user_id = $1',
          [userId]
        );
        await this.db.query(
          'UPDATE user_profiles SET friends = friends + 1 WHERE user_id = $1',
          [followerId]
        );
      }

      // Invalidate cache
      await this.redis.del(`profile:${userId}`);
      await this.redis.del(`profile:${followerId}`);

      logger.info(`User ${followerId} followed user ${userId}`);

      return {
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        followerId: result.rows[0].follower_id,
        createdAt: result.rows[0].created_at,
      };
    } catch (error) {
      logger.error(`Error following user: ${(error as Error).message}`);
      throw error;
    }
  }

  async unfollow(userId: string, followerId: string): Promise<boolean> {
    try {
      // Check if it was a mutual friendship BEFORE deleting
      const wasMutual = await this.isFollowing(followerId, userId);

      const result: QueryResult = await this.db.query(
        'DELETE FROM user_followers WHERE user_id = $1 AND follower_id = $2',
        [userId, followerId]
      );

      if (result.rowCount === 0) {
        return false;
      }

      // Update follower count
      await this.db.query(
        'UPDATE user_profiles SET followers = followers - 1 WHERE user_id = $1 AND followers > 0',
        [userId]
      );

      // Update following count
      await this.db.query(
        'UPDATE user_profiles SET following = following - 1 WHERE user_id = $1 AND following > 0',
        [followerId]
      );

      // If was mutual → both lose a friend
      if (wasMutual) {
        await this.db.query(
          'UPDATE user_profiles SET friends = GREATEST(0, friends - 1) WHERE user_id = $1',
          [userId]
        );
        await this.db.query(
          'UPDATE user_profiles SET friends = GREATEST(0, friends - 1) WHERE user_id = $1',
          [followerId]
        );
      }

      // Invalidate cache
      await this.redis.del(`profile:${userId}`);
      await this.redis.del(`profile:${followerId}`);

      logger.info(`User ${followerId} unfollowed user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error unfollowing user: ${(error as Error).message}`);
      return false;
    }
  }

  async isFollowing(userId: string, followerId: string): Promise<boolean> {
    try {
      const result: QueryResult = await this.db.query(
        'SELECT id FROM user_followers WHERE user_id = $1 AND follower_id = $2',
        [userId, followerId]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Error checking if following: ${(error as Error).message}`);
      return false;
    }
  }

  async getFollowers(userId: string, limit: number = 20, offset: number = 0): Promise<UserFollower[]> {
    try {
      const result: QueryResult = await this.db.query(
        'SELECT id, user_id, follower_id, created_at FROM user_followers WHERE user_id = $1 LIMIT $2 OFFSET $3',
        [userId, limit, offset]
      );

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        followerId: row.follower_id,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error(`Error getting followers: ${(error as Error).message}`);
      return [];
    }
  }

  async getFollowing(userId: string, limit: number = 20, offset: number = 0): Promise<FollowingUser[]> {
    try {
      const result: QueryResult = await this.db.query(
        'SELECT id, user_id as following_id, follower_id, created_at FROM user_followers WHERE follower_id = $1 LIMIT $2 OFFSET $3',
        [userId, limit, offset]
      );

      return result.rows.map(row => ({
        id: row.id,
        userId: row.follower_id,
        followingId: row.following_id,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error(`Error getting following: ${(error as Error).message}`);
      return [];
    }
  }

  async getFollowerCount(userId: string): Promise<number> {
    try {
      const result: QueryResult = await this.db.query(
        'SELECT followers FROM user_profiles WHERE user_id = $1',
        [userId]
      );

      return result.rows.length > 0 ? result.rows[0].followers : 0;
    } catch (error) {
      logger.error(`Error getting follower count: ${(error as Error).message}`);
      return 0;
    }
  }

  async getFollowingCount(userId: string): Promise<number> {
    try {
      const result: QueryResult = await this.db.query(
        'SELECT following FROM user_profiles WHERE user_id = $1',
        [userId]
      );

      return result.rows.length > 0 ? result.rows[0].following : 0;
    } catch (error) {
      logger.error(`Error getting following count: ${(error as Error).message}`);
      return 0;
    }
  }

  async searchByInterests(interests: string[], limit: number = 20): Promise<UserProfile[]> {
    try {
      const result: QueryResult = await this.db.query(
        `SELECT id, user_id, first_name, last_name, username, bio, location, interests, photos, followers, following, friends, created_at, updated_at
         FROM user_profiles
         WHERE interests && $1::text[]
         LIMIT $2`,
        [interests, limit]
      );

      return result.rows.map(row => this.mapToProfile(row));
    } catch (error) {
      logger.error(`Error searching by interests: ${(error as Error).message}`);
      return [];
    }
  }

  async searchUsers(query: string, limit: number = 20): Promise<UserProfile[]> {
    try {
      const q = `%${query}%`;
      const result: QueryResult = await this.db.query(
        `SELECT id, user_id, first_name, last_name, username, bio, location, interests, photos, followers, following, friends, created_at, updated_at
         FROM user_profiles
         WHERE
           user_id::text ILIKE $1
           OR username ILIKE $1
           OR first_name ILIKE $1
           OR last_name ILIKE $1
           OR (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) ILIKE $1
         ORDER BY followers DESC, created_at ASC
         LIMIT $2`,
        [q, limit]
      );
      return result.rows.map(row => this.mapToProfile(row));
    } catch (error) {
      logger.error(`Error searching users: ${(error as Error).message}`);
      return [];
    }
  }

  async discoverUsers(limit: number = 20): Promise<UserProfile[]> {
    try {
      const result: QueryResult = await this.db.query(
        `SELECT id, user_id, first_name, last_name, username, bio, location, interests, photos, followers, following, friends, created_at, updated_at
         FROM user_profiles
         ORDER BY followers DESC, created_at DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows.map(row => this.mapToProfile(row));
    } catch (error) {
      logger.error(`Error discovering users: ${(error as Error).message}`);
      return [];
    }
  }

  async searchByLocation(location: string, limit: number = 20): Promise<UserProfile[]> {
    try {
      const result: QueryResult = await this.db.query(
        `SELECT id, user_id, first_name, last_name, username, bio, location, interests, photos, followers, following, friends, created_at, updated_at
         FROM user_profiles
         WHERE location ILIKE $1
         LIMIT $2`,
        [`%${location}%`, limit]
      );

      return result.rows.map(row => this.mapToProfile(row));
    } catch (error) {
      logger.error(`Error searching by location: ${(error as Error).message}`);
      return [];
    }
  }

  private mapToProfile(row: any): UserProfile {
    return {
      id: row.id,
      userId: row.user_id,
      firstName: row.first_name || undefined,
      lastName: row.last_name || undefined,
      username: row.username || undefined,
      bio: row.bio,
      location: row.location,
      interests: row.interests || [],
      photos: row.photos || [],
      followers: row.followers,
      following: row.following,
      friends: row.friends ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}