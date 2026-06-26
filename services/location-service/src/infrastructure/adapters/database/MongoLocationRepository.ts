import { Model } from 'mongoose';
import { RedisGeoCache } from '../../../../../../shared/utils/RedisCache';
import { ILocationRepository } from '../../../domain/repositories/ILocationRepository';
import { Location, LocationHistory, NearbyUser, LocationSearchParams } from '../../../domain/entities/Location';
import { Logger } from '../../../../../../shared/utils/logger';

const logger = new Logger('MongoLocationRepository');

export class MongoLocationRepository implements ILocationRepository {
  constructor(
    private locationModel: Model<any>,
    private locationHistoryModel: Model<any>,
    private redisGeo: RedisGeoCache
  ) {}

  async updateLocation(location: Location): Promise<Location> {
    try {
      const [longitude, latitude] = location.coordinates.coordinates;

      // Update MongoDB
      const updatedLocation = await this.locationModel.findOneAndUpdate(
        { userId: location.userId },
        {
          userId: location.userId,
          coordinates: location.coordinates,
          address: location.address,
          accuracy: location.accuracy,
          altitude: location.altitude,
          heading: location.heading,
          speed: location.speed,
          timestamp: location.timestamp,
          updatedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      // Update Redis Geo
      await this.redisGeo.addLocation(
        'active_users',
        longitude,
        latitude,
        location.userId
      );

      // Add to history
      await this.addToHistory(updatedLocation);

      logger.info(`Location updated for user: ${location.userId}`);
      return updatedLocation;
    } catch (error) {
      logger.error(`Error updating location: ${(error as Error).message}`);
      throw error;
    }
  }

  async getLocation(userId: string): Promise<Location | null> {
    try {
      const location = await this.locationModel.findOne({ userId });
      return location || null;
    } catch (error) {
      logger.error(`Error getting location: ${(error as Error).message}`);
      return null;
    }
  }

  async deleteLocation(userId: string): Promise<boolean> {
    try {
      const result = await this.locationModel.deleteOne({ userId });

      // Remove from Redis Geo
      await this.redisGeo.removeLocation('active_users', userId);

      logger.info(`Location deleted for user: ${userId}`);
      return result.deletedCount > 0;
    } catch (error) {
      logger.error(`Error deleting location: ${(error as Error).message}`);
      return false;
    }
  }

  async findNearby(params: LocationSearchParams): Promise<NearbyUser[]> {
    try {
      const radiusMeters = params.radiusMeters || 200;
      const limit = params.limit || 50;

      const locations = await this.locationModel
        .find({
          coordinates: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [params.longitude, params.latitude],
              },
              $maxDistance: radiusMeters,
            },
          },
        })
        .limit(limit)
        .select('userId coordinates address timestamp updatedAt');

      return locations.map(loc => ({
        userId: loc.userId,
        distance: this.calculateDistance(
          params.latitude,
          params.longitude,
          loc.coordinates.coordinates[1],
          loc.coordinates.coordinates[0]
        ),
        coordinates: loc.coordinates,
        address: loc.address,
        lastUpdated: loc.updatedAt,
      }));
    } catch (error) {
      logger.error(`Error finding nearby: ${(error as Error).message}`);
      return [];
    }
  }

  async findNearbyUsers(userId: string, radiusMeters: number = 200): Promise<NearbyUser[]> {
    try {
      const userLocation = await this.getLocation(userId);

      if (!userLocation) {
        return [];
      }

      const [longitude, latitude] = userLocation.coordinates.coordinates;

      return await this.findNearby({
        latitude,
        longitude,
        radiusMeters,
      });
    } catch (error) {
      logger.error(`Error finding nearby users: ${(error as Error).message}`);
      return [];
    }
  }

  async findLocationsByArea(params: LocationSearchParams): Promise<Location[]> {
    try {
      const radiusMeters = params.radiusMeters || 200;
      const limit = params.limit || 50;

      const locations = await this.locationModel
        .find({
          coordinates: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [params.longitude, params.latitude],
              },
              $maxDistance: radiusMeters,
            },
          },
        })
        .limit(limit);

      return locations;
    } catch (error) {
      logger.error(`Error finding locations by area: ${(error as Error).message}`);
      return [];
    }
  }

  async getLocationHistory(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<LocationHistory[]> {
    try {
      const history = await this.locationHistoryModel
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(offset);

      return history;
    } catch (error) {
      logger.error(`Error getting location history: ${(error as Error).message}`);
      return [];
    }
  }

  async addToHistory(location: Location): Promise<LocationHistory> {
    try {
      const historyEntry = await this.locationHistoryModel.create({
        userId: location.userId,
        coordinates: location.coordinates,
        address: location.address,
        timestamp: location.timestamp,
        createdAt: new Date(),
      });

      logger.debug(`Location added to history for user: ${location.userId}`);
      return historyEntry;
    } catch (error) {
      logger.error(`Error adding to history: ${(error as Error).message}`);
      throw error;
    }
  }

  async clearHistory(userId: string): Promise<boolean> {
    try {
      const result = await this.locationHistoryModel.deleteMany({ userId });
      logger.info(`Location history cleared for user: ${userId}`);
      return result.deletedCount > 0;
    } catch (error) {
      logger.error(`Error clearing history: ${(error as Error).message}`);
      return false;
    }
  }

  async searchByAddress(address: string, limit: number = 20): Promise<Location[]> {
    try {
      const locations = await this.locationModel
        .find({ address: { $regex: address, $options: 'i' } })
        .limit(limit);

      return locations;
    } catch (error) {
      logger.error(`Error searching by address: ${(error as Error).message}`);
      return [];
    }
  }

  async getLocationStats(userId: string): Promise<any> {
    try {
      const history = await this.locationHistoryModel.find({ userId });

      if (history.length === 0) {
        return { totalLocations: 0 };
      }

      const lats = history.map(h => h.coordinates.coordinates[1]);
      const lngs = history.map(h => h.coordinates.coordinates[0]);

      const avgLat = lats.reduce((a, b) => a + b) / lats.length;
      const avgLng = lngs.reduce((a, b) => a + b) / lngs.length;

      const maxLat = Math.max(...lats);
      const minLat = Math.min(...lats);
      const maxLng = Math.max(...lngs);
      const minLng = Math.min(...lngs);

      return {
        totalLocations: history.length,
        avgLocation: {
          type: 'Point',
          coordinates: [avgLng, avgLat],
        },
        bounds: {
          north: maxLat,
          south: minLat,
          east: maxLng,
          west: minLng,
        },
        firstLocation: history[history.length - 1].timestamp,
        lastLocation: history[0].timestamp,
      };
    } catch (error) {
      logger.error(`Error getting location stats: ${(error as Error).message}`);
      return {};
    }
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance);
  }
}