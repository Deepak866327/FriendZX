import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { storage } from '@/utils/storage';
import { User } from '@/types/api';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithOAuth } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const userRaw = params.get('user');

    if (!token || !userRaw) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    try {
      const user: User = JSON.parse(userRaw);
      storage.setToken(token);
      if (refreshToken) storage.setRefreshToken(refreshToken);
      storage.setUser(user);
      loginWithOAuth(token, user);
      navigate('/dashboard', { replace: true });
    } catch {
      navigate('/login?error=oauth_failed', { replace: true });
    }
  }, []);

  return (
    <div className="loading">
      <div className="loading-spinner"></div>
    </div>
  );
};
