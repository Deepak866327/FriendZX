import React, { createContext, useState, useCallback, useEffect } from 'react';
import { User, AuthResponse } from '@/types/api';
import { LoginCredentials, RegisterCredentials } from '@/types/models';
import { authService } from '@/services/authService';
import { storage } from '@/utils/storage';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  loginWithOAuth: (token: string, user: User) => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize from storage
  useEffect(() => {
    const storedUser = storage.getUser();
    const storedToken = storage.getToken();

    if (storedUser && storedToken) {
      setUser(storedUser);
      setToken(storedToken);
    }

    setIsLoading(false);
  }, []);

  // Listen for 401 events from the API client
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authService.login(credentials);
      setUser(response.user);
      setToken(response.token);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authService.register(credentials);
      setUser(response.user);
      setToken(response.token);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithOAuth = useCallback((token: string, user: User) => {
    setToken(token);
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setUser(null);
      setToken(null);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Logout failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    error,
    login,
    register,
    loginWithOAuth,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};