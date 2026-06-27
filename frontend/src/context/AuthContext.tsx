import React, { createContext, useState, useCallback, useEffect } from 'react';
import { User, AuthResponse } from '@/types/api';
import { LoginCredentials, RegisterCredentials } from '@/types/models';
import { authService } from '@/services/authService';
import { setApiToken } from '@/services/api';
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

// Decode a JWT payload and check whether it has expired.
// We never verify the signature here — that's the server's job.
// We just read the `exp` claim to avoid an unnecessary /refresh round-trip.
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is in seconds; add a 30-second buffer so we refresh slightly early
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyToken = useCallback((newToken: string | null) => {
    setToken(newToken);
    setApiToken(newToken); // keeps api.ts module var + sessionStorage in sync
  }, []);

  useEffect(() => {
    // Remove stale localStorage keys left over from before the HttpOnly cookie
    // migration — purely cosmetic cleanup so DevTools isn't confusing.
    storage.clearOldLocalStorage();

    const restoreSession = async () => {
      const cachedToken = storage.getToken();
      const cachedUser = storage.getUser();

      // ── Fast path: valid token already in this tab's sessionStorage ──────────
      // Skip the /refresh call entirely. This is what prevents Tab 1 (User A)
      // from being overwritten when Tab 2 logs in as User B — each tab holds its
      // own access token in its own sessionStorage and only touches the shared
      // cookie when the token actually expires.
      if (cachedToken && !isTokenExpired(cachedToken) && cachedUser) {
        applyToken(cachedToken);
        setUser(cachedUser);
        setIsLoading(false);
        return;
      }

      // ── Slow path: token missing or expired → ask the server to refresh ──────
      // The browser automatically sends the HttpOnly refresh_token cookie.
      // NOTE: if another tab has since logged in as a different user, this will
      // return that user — intentional, as the refresh token rotates on every use.
      try {
        const data: AuthResponse = await authService.refreshToken();
        applyToken(data.token);
        setUser(data.user);
      } catch {
        applyToken(null);
        setUser(null);
        storage.clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      applyToken(null);
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [applyToken]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await authService.login(credentials);
      applyToken(response.token);
      setUser(response.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [applyToken]);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await authService.register(credentials);
      applyToken(response.token);
      setUser(response.user);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [applyToken]);

  const loginWithOAuth = useCallback((oauthToken: string, oauthUser: User) => {
    applyToken(oauthToken);
    setUser(oauthUser);
    storage.setUser(oauthUser);
  }, [applyToken]);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await authService.logout(); // backend clears the HttpOnly cookie
    } catch (err: any) {
      setError(err.message || 'Logout failed');
    } finally {
      applyToken(null);
      setUser(null);
      setError(null);
      setIsLoading(false);
    }
  }, [applyToken]);

  const clearError = useCallback(() => setError(null), []);

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
