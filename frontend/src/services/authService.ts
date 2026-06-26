import { apiClient } from './api';
import { AuthResponse, User } from '@/types/api';
import { LoginCredentials, RegisterCredentials } from '@/types/models';
import { storage } from '@/utils/storage';

export const authService = {
  // Send OTP to email
  sendOtp: async (email: string): Promise<void> => {
    await apiClient.post('/auth/send-otp', { email });
  },

  // Check username availability
  checkUsername: async (username: string): Promise<{ available: boolean; error?: string }> => {
    const res = await apiClient.get<{ available: boolean; error?: string }>(`/auth/username/check/${username}`);
    return res.data;
  },

  // Register new user
  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', credentials);
    const data = response.data;

    // Store tokens and user
    storage.setToken(data.token);
    storage.setRefreshToken(data.refreshToken);
    storage.setUser(data.user);

    return data;
  },

  // Login user
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    const data = response.data;

    // Store tokens and user
    storage.setToken(data.token);
    storage.setRefreshToken(data.refreshToken);
    storage.setUser(data.user);

    return data;
  },

  // Get current user profile
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/profile');
    return response.data;
  },

  // Logout user
  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      storage.clearAuth();
    }
  },

  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    return !!storage.getToken();
  },

  // Get current user from storage
  getCurrentUser: (): User | null => {
    return storage.getUser();
  },

  // Get auth token
  getToken: (): string | null => {
    return storage.getToken();
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  },

  // Refresh token
  refreshToken: async (): Promise<AuthResponse> => {
    const refreshToken = storage.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiClient.post<AuthResponse>('/auth/refresh', {
      refreshToken,
    });
    const data = response.data;

    storage.setToken(data.token);
    storage.setRefreshToken(data.refreshToken);
    storage.setUser(data.user);

    return data;
  },
};