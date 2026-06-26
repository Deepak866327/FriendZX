import { AUTH_STORAGE_KEYS } from './constants';

export const storage = {
  // Token management
  setToken: (token: string) => {
    localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, token);
  },

  getToken: (): string | null => {
    return localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
  },

  removeToken: () => {
    localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
  },

  // Refresh token management
  setRefreshToken: (token: string) => {
    localStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, token);
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
  },

  removeRefreshToken: () => {
    localStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
  },

  // User management
  setUser: (user: any) => {
    localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(user));
  },

  getUser: (): any => {
    const user = localStorage.getItem(AUTH_STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : null;
  },

  removeUser: () => {
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
  },

  // Clear all auth data
  clearAuth: () => {
    storage.removeToken();
    storage.removeRefreshToken();
    storage.removeUser();
  },

  // Session management
  setSessionData: (key: string, value: any) => {
    sessionStorage.setItem(key, JSON.stringify(value));
  },

  getSessionData: (key: string): any => {
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },

  removeSessionData: (key: string) => {
    sessionStorage.removeItem(key);
  },
};