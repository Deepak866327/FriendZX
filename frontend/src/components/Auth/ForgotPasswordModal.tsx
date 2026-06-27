import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, KeyRound, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/services/api';
import { OtpInput } from '@/components/Common/OtpInput';
import { overlayVariants, modalVariants, pageVariants } from '@/utils/animations';

type Step = 'email' | 'reset' | 'success';

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
  const [showPw,      setShowPw]      = useState(false);
  const [countdown,   setCountdown]   = useState(0);

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
    if (!otp.trim())              return setError('Enter the 6-digit code');
    if (!newPassword)             return setError('Enter a new password');
    if (newPassword.length < 6)  return setError('Password must be at least 6 characters');
    if (newPassword !== confirmPw) return setError('Passwords do not match');
    setError(''); setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { email: email.trim(), otp: otp.trim(), newPassword });
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      >
        {/* Dark tint */}
        <div className="absolute inset-0 bg-[#0f0a28]/40" />

        <motion.div
          className="glass-strong w-full max-w-sm rounded-3xl p-7 relative z-10"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 btn-icon w-8 h-8 rounded-xl"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          {/* Back (reset step only) */}
          {step === 'reset' && (
            <button
              onClick={() => { setStep('email'); setError(''); setOtp(''); }}
              className="absolute top-5 left-5 btn-icon w-8 h-8 rounded-xl"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
          )}

          {/* ── Animated step content ── */}
          <AnimatePresence mode="wait">

            {step === 'success' && (
              <motion.div
                key="success"
                className="flex flex-col items-center text-center gap-4 py-2"
                variants={pageVariants} initial="hidden" animate="visible" exit="exit"
              >
                <motion.div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 360 }}
                >
                  <CheckCircle size={30} />
                </motion.div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Password Reset!</h3>
                  <p className="text-sm text-slate-400 mt-1">Your password has been updated. You can now log in.</p>
                </div>
                <button className="btn-primary w-full mt-2" onClick={onClose}>
                  Back to Login
                </button>
              </motion.div>
            )}

            {step === 'email' && (
              <motion.form
                key="email"
                onSubmit={sendCode}
                className="flex flex-col gap-5"
                variants={pageVariants} initial="hidden" animate="visible" exit="exit"
              >
                <div className="flex flex-col items-center text-center gap-1 pt-2 pb-1">
                  <motion.div
                    className="w-13 h-13 w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-white mb-2"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 360 }}
                  >
                    <KeyRound size={22} />
                  </motion.div>
                  <h3 className="font-bold text-slate-800 text-lg">Forgot password?</h3>
                  <p className="text-sm text-slate-400">Enter your email and we'll send a reset code.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fp-email" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Email address
                  </label>
                  <input
                    id="fp-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    required
                    className="input-glass"
                  />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="rounded-xl px-4 py-3 text-sm text-red-600 flex items-start gap-2"
                      style={{ background: 'rgba(254,242,242,0.9)', border: '1px solid rgba(252,165,165,0.5)' }}
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                    >
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-red-400" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={loading}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" />
                      </svg>
                      Sending…
                    </span>
                  ) : 'Send Reset Code'}
                </motion.button>
              </motion.form>
            )}

            {step === 'reset' && (
              <motion.form
                key="reset"
                onSubmit={resetPassword}
                className="flex flex-col gap-4"
                variants={pageVariants} initial="hidden" animate="visible" exit="exit"
              >
                <div className="flex flex-col items-center text-center gap-1 pt-6 pb-1">
                  <h3 className="font-bold text-slate-800 text-lg">Enter reset code</h3>
                  <p className="text-sm text-slate-400">
                    Sent to <span className="font-semibold text-slate-600 break-all">{email}</span>
                  </p>
                </div>

                {/* 6-box OTP */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">
                    Reset code
                  </label>
                  <OtpInput value={otp} onChange={setOtp} />
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
                  <AnimatePresence>
                    {confirmPw && confirmPw !== newPassword && (
                      <motion.p
                        className="text-xs text-red-500"
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        Passwords do not match
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="rounded-xl px-4 py-3 text-sm text-red-600 flex items-start gap-2"
                      style={{ background: 'rgba(254,242,242,0.9)', border: '1px solid rgba(252,165,165,0.5)' }}
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                    >
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-red-400" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={loading}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" />
                      </svg>
                      Resetting…
                    </span>
                  ) : 'Reset Password'}
                </motion.button>

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
              </motion.form>
            )}

          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
