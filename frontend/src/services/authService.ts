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

  // Register new user — backend sets refresh_token HttpOnly cookie, returns { token, user }
  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', credentials);
    const data = response.data;
    storage.setUser(data.user);
    return data;
  },

  // Login — backend sets refresh_token HttpOnly cookie, returns { token, user }
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    const data = response.data;
    storage.setUser(data.user);
    return data;
  },

  // Get current user profile
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/profile');
    return response.data;
  },

  // Logout — backend clears the HttpOnly cookie; we clear user from sessionStorage
  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      storage.clearAuth();
    }
  },

  // Silent refresh — browser auto-sends the HttpOnly refresh_token cookie, no body needed.
  // Returns a new { token, user } pair. Called on app mount to restore session after page reload.
  refreshToken: async (): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/refresh');
    const data = response.data;
    storage.setUser(data.user);
    return data;
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  },
};
