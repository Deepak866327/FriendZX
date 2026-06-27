import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Compass } from 'lucide-react';
import { Logo } from '@/components/Common/Logo';
import { modalVariants, pageVariants } from '@/utils/animations';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      className="fx-bg min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Background blobs */}
      <div className="fx-bg-blob-1" />
      <div className="fx-bg-blob-2" />
      <div className="fx-bg-blob-3" />

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm">
        {/* Logo */}
        <Logo size="md" />

        {/* 404 number */}
        <motion.div
          className="text-center select-none"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
        >
          <span
            className="block font-black leading-none tracking-tighter"
            style={{
              fontSize: 'clamp(6rem, 30vw, 9rem)',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 45%, #38bdf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            404
          </span>
        </motion.div>

        {/* Glass card */}
        <motion.div
          className="glass-strong rounded-3xl p-7 w-full text-center flex flex-col items-center gap-5"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
            <Compass size={28} className="text-indigo-500" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">Page not found</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Looks like you've wandered off the map. This page doesn't exist or has been moved.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 w-full">
            <button
              className="btn-primary w-full gap-2"
              onClick={() => navigate('/')}
            >
              <Home size={16} />
              Go Home
            </button>
            <button
              className="btn-secondary w-full gap-2"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={16} />
              Go Back
            </button>
          </div>
        </motion.div>

        {/* Footer hint */}
        <p className="text-xs text-slate-400 text-center">
          Lost? Try heading back to your{' '}
          <button
            onClick={() => navigate('/dashboard')}
            className="text-indigo-500 font-medium hover:underline"
          >
            dashboard
          </button>
        </p>
      </div>
    </motion.div>
  );
};
