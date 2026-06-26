import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LoginCredentials } from '@/types/models';

export const LoginForm: React.FC = () => {
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
    <form onSubmit={handleSubmit} noValidate>
      {/* Identifier — email or username */}
      <div className="input-float">
        <input
          id="identifier"
          type="text"
          name="identifier"
          value={form.identifier}
          onChange={handleChange}
          placeholder=" "
          disabled={isLoading}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
        />
        <label htmlFor="identifier">Email or username</label>
        {validErr.identifier && <span className="error">{validErr.identifier}</span>}
      </div>

      {/* Password */}
      <div className="input-float" style={{ position: 'relative' }}>
        <input
          id="password"
          type={showPw ? 'text' : 'password'}
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder=" "
          disabled={isLoading}
          autoComplete="current-password"
          style={{ paddingRight: '44px' }}
        />
        <label htmlFor="password">Password</label>
        <button
          type="button"
          className="login-eye-btn"
          tabIndex={-1}
          onClick={() => setShowPw(v => !v)}
          aria-label={showPw ? 'Hide password' : 'Show password'}
        >
          {showPw ? '🙈' : '👁️'}
        </button>
        {validErr.password && <span className="error">{validErr.password}</span>}
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        type="submit"
        disabled={isLoading || !form.identifier.trim() || !form.password}
        className="btn btn-primary"
        style={{ marginTop: '12px' }}
      >
        {isLoading ? 'Logging in…' : 'Log In'}
      </button>
    </form>
  );
};
