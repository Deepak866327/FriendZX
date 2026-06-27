import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RegisterForm } from '@/components/Auth/RegisterForm';
import { Logo } from '@/components/Common/Logo';
import { useAuth } from '@/hooks/useAuth';
import { modalVariants, pageVariants } from '@/utils/animations';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

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
      style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #f5f3ff 45%, #ede9fe 100%)', backgroundAttachment: 'fixed' }}
    >
      {/* Animated background blobs */}
      <div className="fx-bg-blob-1" />
      <div className="fx-bg-blob-2" />
      <div className="fx-bg-blob-3" />

      {/* Amber accent blob */}
      <div
        className="pointer-events-none fixed"
        style={{
          bottom: '-8%', right: '-4%',
          width: 400, height: 400,
          borderRadius: '9999px',
          background: 'radial-gradient(circle, rgba(253,230,138,0.40) 0%, transparent 70%)',
          filter: 'blur(72px)',
          zIndex: 0,
        }}
      />

      {/* Card spotlight glow */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 560, height: 560,
          borderRadius: '9999px',
          background: 'radial-gradient(ellipse, rgba(236,72,153,0.10) 0%, transparent 65%)',
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
            className="flex flex-col items-center gap-1 mb-6"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          >
            <Logo variant="full" size="lg" />
            <p className="text-sm text-slate-500 mt-2 font-medium tracking-wide">Join the people around you.</p>
          </motion.div>

          {/* Registration form — passes Google handler so it can render the OAuth button in step 1 */}
          <RegisterForm onGoogleAuth={handleGoogle} />
        </motion.div>

        {/* ── Footer link card ── */}
        <motion.div
          className="glass rounded-2xl px-6 py-4 text-center text-sm text-slate-500"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        >
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            Log in
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
};
