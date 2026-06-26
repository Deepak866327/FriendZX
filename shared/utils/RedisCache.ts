import Redis from 'ioredis';
import { Logger } from './logger';

const logger = new Logger('RedisCache');

export class RedisCache {
  private redis: Redis;

  constructor(url: string = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.redis = new Redis(url);

    this.redis.on('connect', () => {
      logger.info('Redis cache connected');
    });

    this.redis.on('error', (err) => {
      logger.error(`Redis error: ${err.message}`);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      logger.error(`Failed to get key ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error(`Failed to set key ${key}: ${(error as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error(`Failed to delete key ${key}: ${(error as Error).message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result > 0;
    } catch (error) {
      logger.error(`Failed to check key ${key}: ${(error as Error).message}`);
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.redis.incr(key);
    } catch (error) {
      logger.error(`Failed to increment key ${key}: ${(error as Error).message}`);
      return 0;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.redis.expire(key, ttl);
    } catch (error) {
      logger.error(`Failed to set expiry for key ${key}: ${(error as Error).message}`);
    }
  }

  async getAll(pattern: string): Promise<Record<string, any>> {
    try {
      const keys = await this.redis.keys(pattern);
      const result: Record<string, any> = {};

      for (const key of keys) {
        const value = await this.redis.get(key);
        result[key] = value ? JSON.parse(value) : null;
      }

      return result;
    } catch (error) {
      logger.error(`Failed to get all keys with pattern ${pattern}: ${(error as Error).message}`);
      return {};
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      logger.info('Redis cache disconnected');
    } catch (error) {
      logger.error(`Failed to disconnect Redis: ${(error as Error).message}`);
    }
  }
}

export class RedisGeoCache {
  private redis: Redis;

  constructor(url: string = process.env.REDIS_GEO_URL || 'redis://localhost:6380') {
    this.redis = new Redis(url);

    this.redis.on('connect', () => {
      logger.info('Redis Geo connected');
    });

    this.redis.on('error', (err) => {
      logger.error(`Redis Geo error: ${err.message}`);
    });
  }

  async addLocation(key: string, longitude: number, latitude: number, member: string): Promise<void> {
    try {
      await this.redis.geoadd(key, longitude, latitude, member);
    } catch (error) {
      logger.error(`Failed to add location: ${(error as Error).message}`);
    }
  }

  async findNearby(
    key: string,
    longitude: number,
    latitude: number,
    radius: number,
    unit: 'm' | 'km' | 'ft' | 'mi' = 'm'
  ): Promise<string[]> {
    try {
      return (await this.redis.georadius(key, longitude, latitude, radius, unit)) as string[];
    } catch (error) {
      logger.error(`Failed to find nearby: ${(error as Error).message}`);
      return [];
    }
  }

  async getDistance(
    key: string,
    member1: string,
    member2: string,
    unit: 'm' | 'km' | 'ft' | 'mi' = 'm'
  ): Promise<number | null> {
    try {
      const dist = await this.redis.geodist(key, member1, member2, unit as any);
      return dist !== null ? parseFloat(dist as string) : null;
    } catch (error) {
      logger.error(`Failed to get distance: ${(error as Error).message}`);
      return null;
    }
  }

  async removeLocation(key: string, member: string): Promise<void> {
    try {
      await this.redis.zrem(key, member);
    } catch (error) {
      logger.error(`Failed to remove location: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      logger.info('Redis Geo disconnected');
    } catch (error) {
      logger.error(`Failed to disconnect Redis Geo: ${(error as Error).message}`);
    }
  }
}