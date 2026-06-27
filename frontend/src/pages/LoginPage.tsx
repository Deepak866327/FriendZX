import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LoginForm } from '@/components/Auth/LoginForm';
import { ForgotPasswordModal } from '@/components/Auth/ForgotPasswordModal';
import { Logo } from '@/components/Common/Logo';
import { useAuth } from '@/hooks/useAuth';
import { modalVariants, pageVariants } from '@/utils/animations';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
    <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [showForgot, setShowForgot] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleGoogle = () => {
    const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000';
    window.location.href = `${gatewayUrl}/api/auth/google`;
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #f5f3ff 45%, #e0e7ff 100%)', backgroundAttachment: 'fixed' }}
    >
      {/* Animated background blobs */}
      <div className="fx-bg-blob-1" />
      <div className="fx-bg-blob-2" />
      <div className="fx-bg-blob-3" />

      {/* Rose accent blob */}
      <div
        className="pointer-events-none fixed"
        style={{
          top: '55%', right: '-6%',
          width: 380, height: 380,
          borderRadius: '9999px',
          background: 'radial-gradient(circle, rgba(251,207,232,0.50) 0%, transparent 70%)',
          filter: 'blur(64px)',
          zIndex: 0,
        }}
      />

      {/* Card spotlight glow */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 560, height: 480,
          borderRadius: '9999px',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.13) 0%, transparent 65%)',
          filter: 'blur(32px)',
          zIndex: 0,
        }}
      />

      <motion.div
        className="relative z-10 w-full max-w-sm flex flex-col gap-3"
        variants={pageVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ── Main glass card ── */}
        <motion.div
          className="glass-strong rounded-3xl p-8"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Logo + tagline */}
          <motion.div
            className="flex flex-col items-center gap-1 mb-7"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          >
            <Logo variant="full" size="lg" />
            <p className="text-sm text-slate-500 mt-2 font-medium tracking-wide">Find your people, nearby.</p>
          </motion.div>

          {/* Email / password form */}
          <LoginForm onForgotPassword={() => setShowForgot(true)} />

          {/* Divider */}
          <div className="divider my-5">OR</div>

          {/* Google sign-in */}
          <motion.button
            type="button"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl glass text-slate-700 font-semibold text-sm"
            style={{ minHeight: 46 }}
            whileHover={{ scale: 1.015, boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          >
            <GoogleIcon />
            Continue with Google
          </motion.button>
        </motion.div>

        {/* ── Footer link card ── */}
        <motion.div
          className="glass rounded-2xl px-6 py-4 text-center text-sm text-slate-500"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        >
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            Sign up
          </Link>
        </motion.div>
      </motion.div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
};
