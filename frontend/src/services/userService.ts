import { apiClient } from './api';
import { UserProfile, UserActivity, PublicProfile, RelationshipStatus } from '@/types/api';
import { UpdateProfileData, PaginationParams } from '@/types/models';

export const userService = {
  // Get user profile
  getProfile: async (): Promise<UserProfile> => {
    const response = await apiClient.get<UserProfile>('/users/profile');
    return response.data;
  },

  // Update user profile
  updateProfile: async (data: UpdateProfileData): Promise<UserProfile> => {
    const response = await apiClient.put<UserProfile>('/users/profile', data);
    return response.data;
  },

  // Get user activity
  getActivity: async (params?: PaginationParams): Promise<UserActivity[]> => {
    const response = await apiClient.get<UserActivity[]>('/users/activity', {
      params,
    });
    return response.data;
  },

  // Get public profile of another user
  getPublicProfile: async (userId: string): Promise<PublicProfile> => {
    const response = await apiClient.get<PublicProfile>(`/users/public/${userId}`);
    return response.data;
  },

  // Upload profile photo
  uploadPhoto: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('photo', file);
    const response = await apiClient.post<{ url: string }>('/users/profile/photo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Get followers list with profiles
  getFollowers: async (limit = 50): Promise<PublicProfile[]> => {
    const response = await apiClient.get<{ followers: PublicProfile[] }>('/users/followers', { params: { limit } });
    return response.data.followers || [];
  },

  // Get following list with profiles
  getFollowing: async (limit = 50): Promise<PublicProfile[]> => {
    const response = await apiClient.get<{ following: PublicProfile[] }>('/users/following', { params: { limit } });
    return response.data.following || [];
  },

  // Add friend (follow)
  addFriend: async (userId: string): Promise<any> => {
    const response = await apiClient.post(`/users/${userId}/follow`);
    return response.data;
  },

  // Remove friend (unfollow)
  removeFriend: async (userId: string): Promise<any> => {
    const response = await apiClient.delete(`/users/${userId}/follow`);
    return response.data;
  },

  // Follow user (alias)
  followUser: async (userId: string): Promise<any> => {
    const response = await apiClient.post(`/users/${userId}/follow`);
    return response.data;
  },

  // Unfollow user (alias)
  unfollowUser: async (userId: string): Promise<any> => {
    const response = await apiClient.delete(`/users/${userId}/follow`);
    return response.data;
  },

  // Remove a follower from your own followers list
  removeFollower: async (followerId: string): Promise<any> => {
    const response = await apiClient.delete(`/users/followers/${followerId}`);
    return response.data;
  },

  // Discover users (sorted by followers, no query needed)
  discoverUsers: async (limit = 20): Promise<PublicProfile[]> => {
    const response = await apiClient.get<PublicProfile[]>('/users/discover', { params: { limit } });
    return response.data;
  },

  // Search users by name or ID
  searchUsers: async (query: string, limit = 20): Promise<PublicProfile[]> => {
    const response = await apiClient.get<PublicProfile[]>('/users/search', {
      params: { q: query, limit },
    });
    return response.data;
  },

  // Check mutual follow status with another user
  getRelationship: async (targetUserId: string): Promise<RelationshipStatus> => {
    const response = await apiClient.get<RelationshipStatus>(`/users/relationship/${targetUserId}`);
    return response.data;
  },

  // Search by interests
  searchByInterests: async (interests: string[], limit?: number): Promise<UserProfile[]> => {
    const response = await apiClient.get<UserProfile[]>('/users/search/interests', {
      params: {
        interests: interests.join(','),
        limit,
      },
    });
    return response.data;
  },

  // Search by location
  searchByLocation: async (location: string, limit?: number): Promise<UserProfile[]> => {
    const response = await apiClient.get<UserProfile[]>('/users/search/location', {
      params: {
        location,
        limit,
      },
    });
    return response.data;
  },
};