import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { authService } from '@/services/authService';
import { useNavigate } from 'react-router-dom';

interface Props {
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
  const { user, logout } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/login');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (pwForm.next !== pwForm.confirm) {
      setPwError('New passwords do not match');
      return;
    }
    if (pwForm.next.length < 6) {
      setPwError('Password must be at least 6 characters');
      return;
    }

    setPwLoading(true);
    try {
      await authService.changePassword(pwForm.current, pwForm.next);
      setPwSuccess(true);
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      setPwError(err.response?.data?.message || err.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-medium settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-body">

          {/* Account Info */}
          <section className="settings-section">
            <h3 className="settings-section-title">Account</h3>
            <div className="settings-info-row">
              <span className="settings-info-label">Name</span>
              <span className="settings-info-value">{user?.firstName} {user?.lastName}</span>
            </div>
            <div className="settings-info-row">
              <span className="settings-info-label">Email</span>
              <span className="settings-info-value">{user?.email}</span>
            </div>
            {user?.lastLogin && (
              <div className="settings-info-row">
                <span className="settings-info-label">Last login</span>
                <span className="settings-info-value">
                  {new Date(user.lastLogin).toLocaleDateString(undefined, {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </section>

          {/* Appearance */}
          <section className="settings-section">
            <h3 className="settings-section-title">Appearance</h3>
            <div className="settings-toggle-row">
              <div className="settings-row-text">
                <span className="settings-row-label">Dark Mode</span>
                <span className="settings-row-desc">Switch between light and dark theme</span>
              </div>
              <button
                className={`settings-toggle ${isDark ? 'on' : ''}`}
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
              >
                <span className="settings-toggle-thumb" />
              </button>
            </div>
          </section>

          {/* Security */}
          <section className="settings-section">
            <h3 className="settings-section-title">Security</h3>
            <p className="settings-section-desc">Change your account password</p>
            <form onSubmit={handleChangePassword} className="settings-pw-form">
              <input
                type="password"
                placeholder="Current password"
                value={pwForm.current}
                onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                disabled={pwLoading}
                autoComplete="current-password"
              />
              <input
                type="password"
                placeholder="New password"
                value={pwForm.next}
                onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                disabled={pwLoading}
                autoComplete="new-password"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={pwForm.confirm}
                onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                disabled={pwLoading}
                autoComplete="new-password"
              />
              {pwError && <p className="settings-feedback settings-feedback-error">{pwError}</p>}
              {pwSuccess && <p className="settings-feedback settings-feedback-success">✓ Password changed successfully</p>}
              <button
                type="submit"
                className="btn btn-secondary btn-sm settings-pw-btn"
                disabled={pwLoading || !pwForm.current || !pwForm.next || !pwForm.confirm}
              >
                {pwLoading ? 'Updating…' : 'Change Password'}
              </button>
            </form>
          </section>

          {/* Log Out */}
          <section className="settings-section settings-danger-section">
            <button className="settings-logout-btn" onClick={handleLogout}>
              Log Out
            </button>
          </section>

        </div>
      </div>
    </div>
  );
};
