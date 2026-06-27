import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { User } from '@/types/api';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithOAuth } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userRaw = params.get('user');

    if (!token || !userRaw) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    try {
      const user: User = JSON.parse(userRaw);
      // The backend already set the HttpOnly refresh_token cookie during the redirect.
      // loginWithOAuth stores the access token in memory and user in sessionStorage.
      loginWithOAuth(token, user);
      // Replace history entry to remove the token from the URL immediately
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
