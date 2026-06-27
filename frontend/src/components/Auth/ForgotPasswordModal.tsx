import React, { useState, useRef, useEffect } from 'react';
import { X, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react';
import { apiClient } from '@/services/api';

type Step = 'email' | 'reset';

interface ForgotPasswordModalProps {
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ onClose }) => {
  const [step,        setStep]        = useState<Step>('email');
  const [email,       setEmail]       = useState('');
  const [otp,         setOtp]         = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [countdown,   setCountdown]   = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const otpRef   = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);
  useEffect(() => { if (step === 'reset') otpRef.current?.focus(); }, [step]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError('Enter your email address');
    setError(''); setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setStep('reset');
      setCountdown(60);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  const resendCode = async () => {
    if (countdown > 0) return;
    setError(''); setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setCountdown(60);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim())             return setError('Enter the 6-digit code');
    if (!newPassword)            return setError('Enter a new password');
    if (newPassword.length < 6)  return setError('Password must be at least 6 characters');
    if (newPassword !== confirmPw) return setError('Passwords do not match');
    setError(''); setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { email: email.trim(), otp: otp.trim(), newPassword });
      setSuccess('Password reset! You can now log in with your new password.');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,40,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      {/* Glass card */}
      <div
        className="glass-strong w-full max-w-sm rounded-3xl p-7 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 btn-icon w-8 h-8 rounded-lg"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Back (reset step only) */}
        {step === 'reset' && !success && (
          <button
            onClick={() => { setStep('email'); setError(''); setOtp(''); }}
            className="absolute top-5 left-5 btn-icon w-8 h-8 rounded-lg"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
        )}

        {success ? (
          /* ── Success ── */
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-glass">
              <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Password Reset!</h3>
              <p className="text-sm text-slate-400 mt-1">Your password has been updated successfully.</p>
            </div>
            <button className="btn-primary w-full mt-2" onClick={onClose}>
              Back to Login
            </button>
          </div>

        ) : step === 'email' ? (
          /* ── Step 1: Enter email ── */
          <form onSubmit={sendCode} className="flex flex-col gap-5">
            {/* Icon + heading */}
            <div className="flex flex-col items-center text-center gap-1 pt-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-glass mb-1">
                <KeyRound size={22} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Forgot password?</h3>
              <p className="text-sm text-slate-400">Enter your email and we'll send a reset code.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-email" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Email address
              </label>
              <input
                ref={emailRef}
                id="fp-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="input-glass"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200/60 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" />
                  </svg>
                  Sending…
                </span>
              ) : 'Send Reset Code'}
            </button>
          </form>

        ) : (
          /* ── Step 2: OTP + new password ── */
          <form onSubmit={resetPassword} className="flex flex-col gap-4">
            <div className="flex flex-col items-center text-center gap-1 pt-1">
              <h3 className="font-bold text-slate-800 text-lg">Enter reset code</h3>
              <p className="text-sm text-slate-400">
                We sent a 6-digit code to{' '}
                <span className="font-semibold text-slate-600">{email}</span>
              </p>
            </div>

            {/* OTP */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-otp" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Reset code
              </label>
              <input
                ref={otpRef}
                id="fp-otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoComplete="one-time-code"
                className="input-glass text-center text-xl font-bold tracking-[0.4em]"
              />
            </div>

            {/* New password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-newpw" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                New password
              </label>
              <div className="relative">
                <input
                  id="fp-newpw"
                  type={showPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  className="input-glass pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-confirm" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Confirm password
              </label>
              <input
                id="fp-confirm"
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                className="input-glass"
              />
              {confirmPw && confirmPw !== newPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200/60 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" />
                  </svg>
                  Resetting…
                </span>
              ) : 'Reset Password'}
            </button>

            {/* Resend */}
            <div className="flex items-center justify-center gap-1.5 text-sm text-slate-400">
              <span>Didn't get it?</span>
              <button
                type="button"
                onClick={resendCode}
                disabled={countdown > 0 || loading}
                className="font-semibold text-indigo-500 hover:text-indigo-700 disabled:text-slate-400 disabled:cursor-default transition-colors"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
