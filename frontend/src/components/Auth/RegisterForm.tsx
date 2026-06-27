import React, { useState, useCallback, useRef } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, Loader, Mail, Phone, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import { OtpInput } from '@/components/Common/OtpInput';
import { pageVariants } from '@/utils/animations';

const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE    = /^[+]?[\d\s\-()\d]{7,15}$/;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
    <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

type Step = 'form' | 'otp';

interface RegisterFormProps {
  onGoogleAuth?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onGoogleAuth }) => {
  const { register, isLoading, error } = useAuth();

  const [step, setStep]             = useState<Step>('form');
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp]               = useState('');

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const usernameDebounce = useRef<ReturnType<typeof setTimeout>>();

  const [sendingOtp, setSendingOtp]         = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  const [formError, setFormError] = useState('');

  const isEmail = EMAIL_RE.test(identifier.trim());
  const isPhone = !isEmail && PHONE_RE.test(identifier.trim().replace(/\s/g, ''));

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

  const usernameAdornment = () => {
    if (usernameStatus === 'checking')  return <Loader size={14} className="animate-spin text-slate-400" />;
    if (usernameStatus === 'available') return <CheckCircle size={14} className="text-emerald-500" />;
    if (usernameStatus === 'taken')     return <XCircle size={14} className="text-red-500" />;
    return null;
  };

  const usernameHint = () => {
    if (usernameStatus === 'available') return <p className="text-xs text-emerald-600">Username is available</p>;
    if (usernameStatus === 'taken')     return <p className="text-xs text-red-500">Username is already taken</p>;
    if (usernameStatus === 'invalid')   return <p className="text-xs text-amber-500">3–20 chars, must start with a letter</p>;
    return null;
  };

  const startCooldown = () => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    setFormError('');
    if (!firstName.trim())           return setFormError('First name is required');
    if (!USERNAME_RE.test(username)) return setFormError('Invalid username format');
    if (usernameStatus === 'taken')  return setFormError('Username is already taken');
    if (password.length < 6)        return setFormError('Password must be at least 6 characters');
    if (!identifier.trim())         return setFormError('Email or mobile number is required');
    if (isPhone) return setFormError('SMS verification coming soon — please use email for now.');
    if (!isEmail) return setFormError('Enter a valid email address or mobile number');

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

  // ── Step progress indicator ─────────────────────────────────────────────────
  const StepDots = () => (
    <div className="flex items-center gap-2 mb-5">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={
            step === 'otp'
              ? { background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white' }
              : { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }
          }
        >
          {step === 'otp' ? '✓' : '1'}
        </div>
        <span className="text-xs font-medium text-slate-600">Details</span>
      </div>

      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #6366f1, #e5e7eb)' }} />

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={
            step === 'otp'
              ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }
              : { background: '#e5e7eb', color: '#94a3b8' }
          }
        >
          2
        </div>
        <span className={`text-xs font-medium ${step === 'otp' ? 'text-slate-600' : 'text-slate-400'}`}>Verify</span>
      </div>
    </div>
  );

  // ── Step 2: OTP verification ────────────────────────────────────────────────
  const OtpStep = (
    <motion.form
      key="otp"
      onSubmit={handleVerify}
      className="flex flex-col gap-4"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <StepDots />

      {/* Header */}
      <div className="flex flex-col items-center text-center gap-1 pb-1">
        <motion.div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-1"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 22, stiffness: 360 }}
        >
          <Mail size={24} />
        </motion.div>
        <p className="font-semibold text-slate-800 text-base">Check your email</p>
        <p className="text-sm text-slate-400">
          We sent a 6-digit code to{' '}
          <span className="font-semibold text-slate-600 break-all">{identifier.trim()}</span>
        </p>
      </div>

      {/* 6-box OTP */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">
          Verification code
        </label>
        <OtpInput value={otp} onChange={setOtp} />
      </div>

      <AnimatePresence>
        {displayErr && (
          <motion.div
            className="rounded-xl px-4 py-3 text-sm text-red-600 flex items-start gap-2"
            style={{ background: 'rgba(254,242,242,0.9)', border: '1px solid rgba(252,165,165,0.5)' }}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-red-400" />
            <span>{displayErr}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="submit"
        disabled={isLoading || otp.length < 6}
        className="btn-primary w-full"
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', damping: 20, stiffness: 400 }}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" />
            </svg>
            Creating account…
          </span>
        ) : 'Verify & Create Account'}
      </motion.button>

      <div className="flex items-center justify-center gap-6 text-sm">
        <button
          type="button"
          onClick={() => { setStep('form'); setFormError(''); setOtp(''); }}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0 || sendingOtp}
          className="font-semibold text-indigo-500 hover:text-indigo-700 disabled:text-slate-400 disabled:cursor-default transition-colors"
        >
          {sendingOtp ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
        </button>
      </div>
    </motion.form>
  );

  // ── Step 1: Registration form ───────────────────────────────────────────────
  const FormStep = (
    <motion.div
      key="form"
      className="flex flex-col gap-4"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <StepDots />

      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="firstName" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            First name *
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="Alex"
            autoComplete="given-name"
            className="input-glass"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lastName" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Last name
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            placeholder="Kim"
            autoComplete="family-name"
            className="input-glass"
          />
        </div>
      </div>

      {/* Username */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Username *
        </label>
        <div className="relative">
          <input
            id="username"
            type="text"
            value={username}
            onChange={e => handleUsernameChange(e.target.value.replace(/\s/g, '').toLowerCase())}
            placeholder="alexkim99"
            autoComplete="username"
            maxLength={20}
            className="input-glass pr-10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {usernameAdornment()}
          </span>
        </div>
        {usernameHint()}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-password" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Password *
        </label>
        <div className="relative">
          <input
            id="reg-password"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            className="input-glass pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            aria-label={showPass ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors"
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {password && password.length < 6 && (
          <p className="text-xs text-amber-500">Password must be at least 6 characters</p>
        )}
      </div>

      {/* Email / Phone */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="identifier" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Email or mobile number *
        </label>
        <div className="relative">
          <input
            id="identifier"
            type="text"
            inputMode="email"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="input-glass pr-10"
          />
          {identifier.trim().length > 3 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {isEmail
                ? <Mail size={14} className="text-emerald-500" />
                : isPhone
                  ? <Phone size={14} className="text-blue-500" />
                  : null}
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {displayErr && (
          <motion.div
            className="rounded-xl px-4 py-3 text-sm text-red-600 flex items-start gap-2"
            style={{ background: 'rgba(254,242,242,0.9)', border: '1px solid rgba(252,165,165,0.5)' }}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-red-400" />
            <span>{displayErr}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        disabled={sendingOtp || !firstName || !username || !password || !identifier}
        onClick={handleSendOtp}
        className="btn-primary w-full mt-1"
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', damping: 20, stiffness: 400 }}
      >
        {sendingOtp ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" />
            </svg>
            Sending OTP…
          </span>
        ) : 'Send Verification Code →'}
      </motion.button>

      {onGoogleAuth && (
        <>
          <div className="divider">OR</div>
          <motion.button
            type="button"
            onClick={onGoogleAuth}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl glass text-slate-700 font-semibold text-sm"
            style={{ minHeight: 46 }}
            whileHover={{ scale: 1.015, boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          >
            <GoogleIcon />
            Continue with Google
          </motion.button>
        </>
      )}
    </motion.div>
  );

  return (
    <AnimatePresence mode="wait">
      {step === 'otp' ? OtpStep : FormStep}
    </AnimatePresence>
  );
};
