import React, { useState, useRef, useEffect } from 'react';
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

  // Countdown timer for resend
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
    if (!otp.trim())         return setError('Enter the 6-digit code');
    if (!newPassword)        return setError('Enter a new password');
    if (newPassword.length < 6) return setError('Password must be at least 6 characters');
    if (newPassword !== confirmPw) return setError('Passwords do not match');
    setError(''); setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        email:       email.trim(),
        otp:         otp.trim(),
        newPassword,
      });
      setSuccess('Password reset! You can now log in with your new password.');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay fp-overlay" onClick={onClose}>
      <div className="fp-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="fp-header">
          {step === 'reset' && !success && (
            <button className="fp-back" onClick={() => { setStep('email'); setError(''); setOtp(''); }}>←</button>
          )}
          <div className="fp-logo">🔑</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {success ? (
          /* ── Success state ── */
          <div className="fp-success">
            <div className="fp-success__icon">✅</div>
            <h3 className="fp-success__title">Password Reset!</h3>
            <p className="fp-success__sub">Your password has been updated successfully.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onClose}>
              Back to Login
            </button>
          </div>
        ) : step === 'email' ? (
          /* ── Step 1: Enter email ── */
          <form className="fp-body" onSubmit={sendCode}>
            <h3 className="fp-title">Forgot Password?</h3>
            <p className="fp-sub">Enter your registered email and we'll send you a reset code.</p>

            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                ref={emailRef}
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Code'}
            </button>
          </form>
        ) : (
          /* ── Step 2: Enter OTP + new password ── */
          <form className="fp-body" onSubmit={resetPassword}>
            <h3 className="fp-title">Enter Reset Code</h3>
            <p className="fp-sub">We sent a 6-digit code to <strong>{email}</strong></p>

            <div className="form-group">
              <label className="form-label">Reset code</label>
              <input
                ref={otpRef}
                type="text"
                className="form-input fp-otp-input"
                placeholder="123456"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </div>

            <div className="form-group">
              <label className="form-label">New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="fp-eye"
                  onClick={() => setShowPw(v => !v)}
                >{showPw ? '🙈' : '👁️'}</button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm new password</label>
              <input
                type={showPw ? 'text' : 'password'}
                className="form-input"
                placeholder="Repeat password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>

            <div className="fp-resend">
              <span>Didn't receive the code? </span>
              <button
                type="button"
                className="fp-resend-btn"
                onClick={resendCode}
                disabled={countdown > 0 || loading}
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
