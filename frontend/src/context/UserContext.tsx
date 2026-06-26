import React, { createContext, useState, useCallback } from 'react';
import { UserProfile } from '@/types/api';
import { UpdateProfileData } from '@/types/models';
import { userService } from '@/services/userService';
import { Logger } from '@/utils/logger';

const logger = new Logger('UserContext');

export interface UserContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  clearError: () => void;
}

export const UserContext = createContext<UserContextType | null>(null);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await userService.getProfile();
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile');
      logger.error('Failed to fetch profile', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileData) => {
    try {
      setIsLoading(true);
      setError(null);
      const updated = await userService.updateProfile(data);
      setProfile(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      logger.error('Failed to update profile', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const followUser = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      await userService.followUser(userId);
      await fetchProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to follow user');
      logger.error('Failed to follow user', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  const unfollowUser = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      await userService.unfollowUser(userId);
      await fetchProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to unfollow user');
      logger.error('Failed to unfollow user', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: UserContextType = {
    profile,
    isLoading,
    error,
    fetchProfile,
    updateProfile,
    followUser,
    unfollowUser,
    clearError,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};