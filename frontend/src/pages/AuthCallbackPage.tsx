import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
      loginWithOAuth(token, user);
      navigate('/dashboard', { replace: true });
    } catch {
      navigate('/login?error=oauth_failed', { replace: true });
    }
  }, []);

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #f5f3ff 45%, #e0e7ff 100%)', backgroundAttachment: 'fixed' }}
    >
      <div className="fx-bg-blob-1" />
      <div className="fx-bg-blob-2" />
      <div className="fx-bg-blob-3" />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-5"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Gradient ring spinner */}
        <div className="relative w-[72px] h-[72px]">
          <svg
            className="w-[72px] h-[72px] animate-spin"
            viewBox="0 0 72 72"
            fill="none"
            style={{ animationDuration: '0.9s', animationTimingFunction: 'linear' }}
          >
            <defs>
              <linearGradient id="cb-spin-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="55%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <circle
              cx="36" cy="36" r="28"
              stroke="url(#cb-spin-grad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="130 46"
            />
          </svg>
          {/* Inner glow */}
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)' }}
          />
        </div>

        <div className="text-center">
          <p className="font-semibold text-slate-700 text-base">Signing you in…</p>
          <p className="text-sm text-slate-400 mt-0.5">Just a moment</p>
        </div>
      </motion.div>
    </div>
  );
};
