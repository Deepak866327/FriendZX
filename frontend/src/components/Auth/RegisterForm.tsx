import React, { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';

const USERNAME_RE  = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
const EMAIL_RE     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE     = /^[+]?[\d\s\-()\d]{7,15}$/;

type Step = 'form' | 'otp';

export const RegisterForm: React.FC = () => {
  const { register, isLoading, error } = useAuth();

  const [step, setStep]           = useState<Step>('form');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [identifier, setIdentifier] = useState(''); // email OR phone
  const [otp, setOtp]             = useState('');

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const usernameDebounce = useRef<ReturnType<typeof setTimeout>>();

  const [sendingOtp, setSendingOtp]         = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  const [formError, setFormError] = useState('');

  // Derive whether identifier is email or phone
  const isEmail = EMAIL_RE.test(identifier.trim());
  const isPhone = !isEmail && PHONE_RE.test(identifier.trim().replace(/\s/g, ''));

  // ── Username check ─────────────────────────────────────────────────────────
  const handleUsernameChange = useCallback((val: string) => {
    setUsername(val);
    setUsernameStatus('idle');
    if (usernameDebounce.current) clearTimeout(usernameDebounce.current);
    if (!val) return;
    if (!USERNAME_RE.test(val)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    usernameDebounce.current = setTimeout(async () => {
      try {
        const res = await authService.checkUsername(val);
        setUsernameStatus(res.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
  }, []);

  const usernameHint = () => {
    if (usernameStatus === 'checking')  return <span style={{ color: 'var(--ig-secondary)', fontSize: '11px' }}>Checking…</span>;
    if (usernameStatus === 'available') return <span style={{ color: '#22c55e', fontSize: '11px' }}>✓ Available</span>;
    if (usernameStatus === 'taken')     return <span style={{ color: '#ef4444', fontSize: '11px' }}>✗ Taken</span>;
    if (usernameStatus === 'invalid')   return <span style={{ color: '#f59e0b', fontSize: '11px' }}>3–20 chars, starts with letter</span>;
    return null;
  };

  // ── OTP helpers ────────────────────────────────────────────────────────────
  const startCooldown = () => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => { if (prev <= 1) { clearInterval(cooldownRef.current); return 0; } return prev - 1; });
    }, 1000);
  };

  const handleSendOtp = async () => {
    setFormError('');
    if (!firstName.trim())           return setFormError('First name is required');
    if (!USERNAME_RE.test(username)) return setFormError('Invalid username format');
    if (usernameStatus === 'taken')  return setFormError('Username is already taken');
    if (password.length < 6)        return setFormError('Password must be at least 6 characters');
    if (!identifier.trim())         return setFormError('Email or mobile number is required');

    if (isPhone) {
      return setFormError('SMS verification is coming soon. Please use your email address for now.');
    }
    if (!isEmail) {
      return setFormError('Enter a valid email address or mobile number');
    }

    setSendingOtp(true);
    try {
      await authService.sendOtp(identifier.trim());
      setStep('otp');
      startCooldown();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || err?.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setSendingOtp(true);
    try { await authService.sendOtp(identifier.trim()); startCooldown(); }
    catch (err: any) { setFormError(err?.response?.data?.error || 'Failed to resend OTP'); }
    finally { setSendingOtp(false); }
  };

  // ── Verify & register ──────────────────────────────────────────────────────
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (otp.trim().length !== 6) return setFormError('Enter the 6-digit verification code');
    try {
      await register({
        firstName,
        lastName,
        username,
        password,
        email: isEmail ? identifier.trim() : '',
        phoneNumber: isPhone ? identifier.trim() : undefined,
        otp,
      });
    } catch (_) {}
  };

  const displayErr = formError || error || '';

  // ── Step 2: OTP ────────────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <form onSubmit={handleVerify}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>{isEmail ? '📧' : '📱'}</div>
          <p style={{ fontWeight: 700, fontSize: '15px', margin: '0 0 4px' }}>Enter verification code</p>
          <p style={{ fontSize: '13px', color: 'var(--ig-secondary)', margin: 0 }}>
            We sent a 6-digit code to <strong>{identifier.trim()}</strong>
          </p>
        </div>

        <div className="input-float">
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder=" "
            autoComplete="one-time-code"
            style={{ letterSpacing: '8px', fontWeight: 700, fontSize: '22px', textAlign: 'center' }}
          />
          <label htmlFor="otp">6-digit code</label>
        </div>

        {displayErr && <div className="error-message">{displayErr}</div>}

        <button type="submit" className="btn btn-primary" disabled={isLoading || otp.length < 6}>
          {isLoading ? 'Creating account…' : 'Verify & Create Account'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '13px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <button type="button" onClick={() => setStep('form')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ig-secondary)' }}>
            ← Back
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || sendingOtp}
            style={{ background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer', color: resendCooldown > 0 ? 'var(--ig-secondary)' : 'var(--ig-blue)', fontWeight: 600 }}
          >
            {sendingOtp ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </button>
        </div>
      </form>
    );
  }

  // ── Step 1: Registration form (no Google button here — it lives in RegisterPage) ──
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <div className="input-float">
          <input id="firstName" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder=" " autoComplete="given-name" />
          <label htmlFor="firstName">First Name *</label>
        </div>
        <div className="input-float">
          <input id="lastName" type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder=" " autoComplete="family-name" />
          <label htmlFor="lastName">Last Name</label>
        </div>
      </div>

      <div className="input-float" style={{ position: 'relative' }}>
        <input
          id="username"
          type="text"
          value={username}
          onChange={e => handleUsernameChange(e.target.value.replace(/\s/g, '').toLowerCase())}
          placeholder=" "
          autoComplete="username"
          maxLength={20}
        />
        <label htmlFor="username">Username *</label>
        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          {usernameHint()}
        </div>
      </div>

      <div className="input-float" style={{ position: 'relative' }}>
        <input
          id="password"
          type={showPass ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder=" "
          autoComplete="new-password"
        />
        <label htmlFor="password">Password *</label>
        <button
          type="button"
          onClick={() => setShowPass(s => !s)}
          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ig-secondary)', fontSize: '14px' }}
        >
          {showPass ? '🙈' : '👁️'}
        </button>
      </div>

      {/* Single combined Email or Mobile Number field */}
      <div className="input-float" style={{ position: 'relative' }}>
        <input
          id="identifier"
          type="text"
          inputMode="email"
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          placeholder=" "
          autoComplete="email"
        />
        <label htmlFor="identifier">Email or Mobile Number *</label>
        {identifier.trim().length > 3 && (
          <span style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '11px', pointerEvents: 'none',
            color: isEmail ? '#22c55e' : isPhone ? '#3b82f6' : 'var(--ig-secondary)',
          }}>
            {isEmail ? '📧 Email' : isPhone ? '📱 Phone' : ''}
          </span>
        )}
      </div>

      {displayErr && <div className="error-message">{displayErr}</div>}

      <button
        type="button"
        className="btn btn-primary"
        disabled={sendingOtp || !firstName || !username || !password || !identifier}
        onClick={handleSendOtp}
      >
        {sendingOtp ? 'Sending OTP…' : 'Send Verification Code →'}
      </button>
    </div>
  );
};
