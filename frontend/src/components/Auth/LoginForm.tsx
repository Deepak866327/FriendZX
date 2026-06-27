import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { LoginCredentials } from '@/types/models';

interface LoginFormProps {
  onForgotPassword?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onForgotPassword }) => {
  const { login, isLoading, error } = useAuth();
  const [form, setForm] = useState<LoginCredentials>({ identifier: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [validErr, setValidErr] = useState<Partial<LoginCredentials>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (validErr[name as keyof LoginCredentials]) {
      setValidErr(prev => { const n = { ...prev }; delete n[name as keyof LoginCredentials]; return n; });
    }
  };

  const validate = (): boolean => {
    const errs: Partial<LoginCredentials> = {};
    if (!form.identifier.trim()) errs.identifier = 'Enter your email or username';
    if (!form.password)          errs.password   = 'Enter your password';
    else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    setValidErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try { await login(form); } catch (_) {}
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

      {/* Identifier */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="identifier" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Email or username
        </label>
        <input
          id="identifier"
          type="text"
          name="identifier"
          value={form.identifier}
          onChange={handleChange}
          placeholder="you@example.com"
          disabled={isLoading}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="input-glass"
          style={validErr.identifier ? { borderColor: 'rgba(239,68,68,0.5)', boxShadow: '0 0 0 3px rgba(239,68,68,0.10)' } : undefined}
        />
        {validErr.identifier && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <span>⚠</span> {validErr.identifier}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Password
          </label>
          {onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              Forgot password?
            </button>
          )}
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
            disabled={isLoading}
            autoComplete="current-password"
            className="input-glass pr-11"
            style={validErr.password ? { borderColor: 'rgba(239,68,68,0.5)', boxShadow: '0 0 0 3px rgba(239,68,68,0.10)' } : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            tabIndex={-1}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors"
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {validErr.password && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <span>⚠</span> {validErr.password}
          </p>
        )}
      </div>

      {/* Backend error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200/60 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !form.identifier.trim() || !form.password}
        className="btn-primary w-full mt-1"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" />
            </svg>
            Logging in…
          </span>
        ) : 'Log In'}
      </button>
    </form>
  );
};
