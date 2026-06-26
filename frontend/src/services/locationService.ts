import { apiClient } from './api';
import { LocationData, NearbyUser } from '@/types/api';
import { UpdateLocationData, PaginationParams } from '@/types/models';

export const locationService = {
  // Update user location
  updateLocation: async (data: UpdateLocationData): Promise<LocationData> => {
    const response = await apiClient.post<LocationData>('/locations/update', data);
    return response.data;
  },

  // Get current location
  getCurrentLocation: async (): Promise<LocationData> => {
    const response = await apiClient.get<LocationData>('/locations/current');
    return response.data;
  },

  // Get nearby users
  getNearby: async (radius?: number, limit?: number): Promise<any> => {
    const response = await apiClient.get('/locations/nearby', {
      params: {
        radius,
        limit,
      },
    });
    return response.data;
  },

  // Search locations
  searchLocations: async (address: string, limit?: number): Promise<any> => {
    const response = await apiClient.get('/locations/search', {
      params: {
        address,
        limit,
      },
    });
    return response.data;
  },

  // Get location history
  getHistory: async (params?: PaginationParams): Promise<any> => {
    const response = await apiClient.get('/locations/history', {
      params,
    });
    return response.data;
  },

  // Clear location history
  clearHistory: async (): Promise<void> => {
    await apiClient.delete('/locations/history');
  },

  // Get geolocation from browser
  getCurrentGeolocation: (): Promise<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number;
    heading?: number;
    speed?: number;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
          });
        },
        (error) => {
          reject(error);
        }
      );
    });
  },

  // Watch geolocation changes
  watchGeolocation: (
    onSuccess: (position: {
      latitude: number;
      longitude: number;
      accuracy?: number;
    }) => void,
    onError: (error: any) => void
  ): number => {
    if (!navigator.geolocation) {
      onError(new Error('Geolocation not supported'));
      return 0;
    }

    return navigator.geolocation.watchPosition(
      (position) => {
        onSuccess({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      onError
    );
  },

  // Stop watching geolocation
  stopWatchingGeolocation: (watchId: number): void => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
    }
  },
};