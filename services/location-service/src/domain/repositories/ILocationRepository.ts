import { Location, LocationHistory, NearbyUser, LocationSearchParams } from '../entities/Location';

export interface ILocationRepository {
  // Current Location
  updateLocation(location: Location): Promise<Location>;
  getLocation(userId: string): Promise<Location | null>;
  deleteLocation(userId: string): Promise<boolean>;

  // Nearby Search
  findNearby(params: LocationSearchParams): Promise<NearbyUser[]>;
  findNearbyUsers(userId: string, radiusMeters?: number): Promise<NearbyUser[]>;
  findLocationsByArea(params: LocationSearchParams): Promise<Location[]>;

  // History
  getLocationHistory(userId: string, limit?: number, offset?: number): Promise<LocationHistory[]>;
  addToHistory(location: Location): Promise<LocationHistory>;
  clearHistory(userId: string): Promise<boolean>;

  // Search
  searchByAddress(address: string, limit?: number): Promise<Location[]>;
  getLocationStats(userId: string): Promise<any>;
}