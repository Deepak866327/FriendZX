import React, { createContext, useState, useCallback, useEffect } from 'react';
import { LocationData, NearbyUser } from '@/types/api';
import { UpdateLocationData } from '@/types/models';
import { locationService } from '@/services/locationService';
import { DEFAULT_LOCATION_UPDATE_INTERVAL } from '@/utils/constants';
import { Logger } from '@/utils/logger';

const logger = new Logger('LocationContext');

export interface LocationContextType {
  currentLocation: LocationData | null;
  nearbyUsers: NearbyUser[];
  isLoading: boolean;
  isTracking: boolean;
  error: string | null;
  searchRadius: number;
  setSearchRadius: (radius: number) => void;
  updateLocation: (data: UpdateLocationData) => Promise<void>;
  getCurrentLocation: () => Promise<void>;
  getNearbyUsers: (radius?: number) => Promise<void>;
  startTracking: (interval?: number) => void;
  stopTracking: () => void;
  clearError: () => void;
}

export const LocationContext = createContext<LocationContextType | null>(null);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState(200);
  const [trackingIntervalId, setTrackingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  const updateLocation = useCallback(async (data: UpdateLocationData) => {
    try {
      setError(null);
      const updated = await locationService.updateLocation(data);
      setCurrentLocation(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update location');
      logger.error('Failed to update location', err);
      throw err;
    }
  }, []);

  const getCurrentLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await locationService.getCurrentLocation();
      setCurrentLocation(data);
    } catch (err: any) {
      setError(err.message || 'Failed to get location');
      logger.error('Failed to get location', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getNearbyUsers = useCallback(async (radius?: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await locationService.getNearby(radius ?? searchRadius, 50);
      setNearbyUsers(result.nearby || []);
    } catch (err: any) {
      setError(err.message || 'Failed to get nearby users');
      logger.error('Failed to get nearby users', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchRadius]);

  const startTracking = useCallback((interval: number = DEFAULT_LOCATION_UPDATE_INTERVAL) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setIsTracking(true);
    setError(null);

    const id = locationService.watchGeolocation(
      async (position) => {
        try {
          await updateLocation({
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy: position.accuracy,
          });
        } catch (err) {
          logger.error('Failed to send location update', err);
        }
      },
      (geoError: GeolocationPositionError) => {
        logger.error('Geolocation error', geoError);
        setIsTracking(false);
        setWatchId(null);
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setError('Location permission denied. Please allow location access in your browser settings and try again.');
            break;
          case geoError.POSITION_UNAVAILABLE:
            setError('Location unavailable. Make sure location services are enabled on your device.');
            break;
          case geoError.TIMEOUT:
            setError('Location request timed out. Please try again.');
            break;
          default:
            setError('Unable to access geolocation. Please check your browser settings.');
        }
      }
    );

    setWatchId(id);

    // Periodically fetch nearby users
    const intervalId = setInterval(() => {
      getNearbyUsers();
    }, interval);

    setTrackingIntervalId(intervalId);
  }, [updateLocation, getNearbyUsers]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);

    if (watchId) {
      locationService.stopWatchingGeolocation(watchId);
      setWatchId(null);
    }

    if (trackingIntervalId) {
      clearInterval(trackingIntervalId);
      setTrackingIntervalId(null);
    }
  }, [watchId, trackingIntervalId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Re-fetch nearby users when radius changes while tracking
  useEffect(() => {
    if (isTracking) {
      getNearbyUsers(searchRadius);
    }
  }, [searchRadius, isTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trackingIntervalId) {
        clearInterval(trackingIntervalId);
      }
      if (watchId) {
        locationService.stopWatchingGeolocation(watchId);
      }
    };
  }, [trackingIntervalId, watchId]);

  const value: LocationContextType = {
    currentLocation,
    nearbyUsers,
    isLoading,
    isTracking,
    error,
    searchRadius,
    setSearchRadius,
    updateLocation,
    getCurrentLocation,
    getNearbyUsers,
    startTracking,
    stopTracking,
    clearError,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};