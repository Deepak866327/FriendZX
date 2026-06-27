import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { RegisterForm } from '@/components/Auth/RegisterForm';
import { Logo } from '@/components/Common/Logo';
import { useAuth } from '@/hooks/useAuth';

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
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'linear-gradient(135deg,#f0f4ff 0%,#faf5ff 50%,#f0f9ff 100%)', backgroundAttachment: 'fixed' }}>

      {/* Background blobs */}
      <div className="fx-bg-blob-1" />
      <div className="fx-bg-blob-2" />
      <div className="fx-bg-blob-3" />

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-3">

        {/* ── Main glass card ── */}
        <div className="glass-strong rounded-3xl p-8">

          {/* Logo */}
          <div className="flex flex-col items-center gap-1 mb-6">
            <Logo variant="full" size="lg" />
            <p className="text-sm text-slate-400 mt-1">Sign up to find people near you.</p>
          </div>

          {/* Form — passes Google handler so it can show/hide it with step state */}
          <RegisterForm onGoogleAuth={handleGoogle} />
        </div>

        {/* ── Footer card ── */}
        <div className="glass rounded-2xl px-6 py-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};
