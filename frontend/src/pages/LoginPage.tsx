import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LoginForm } from '@/components/Auth/LoginForm';
import { ForgotPasswordModal } from '@/components/Auth/ForgotPasswordModal';
import { Logo } from '@/components/Common/Logo';
import { useAuth } from '@/hooks/useAuth';

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
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'linear-gradient(135deg,#f0f4ff 0%,#faf5ff 50%,#f0f9ff 100%)', backgroundAttachment: 'fixed' }}>

      {/* Background blobs */}
      <div className="fx-bg-blob-1" />
      <div className="fx-bg-blob-2" />
      <div className="fx-bg-blob-3" />

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-3">

        {/* ── Main glass card ── */}
        <div className="glass-strong rounded-3xl p-8">

          {/* Logo */}
          <div className="flex flex-col items-center gap-1 mb-7">
            <Logo variant="full" size="lg" />
            <p className="text-sm text-slate-400 mt-1">Find your people, nearby.</p>
          </div>

          {/* Form */}
          <LoginForm onForgotPassword={() => setShowForgot(true)} />

          {/* Divider */}
          <div className="divider my-5">OR</div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-white border border-slate-200/80 text-slate-700 font-semibold text-sm shadow-sm transition-all duration-200 hover:bg-slate-50 hover:shadow-md active:scale-95"
            style={{ minHeight: 44 }}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        {/* ── Footer card ── */}
        <div className="glass rounded-2xl px-6 py-4 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            Sign up
          </Link>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
};
