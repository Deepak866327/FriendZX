import React, { useState } from 'react';
import { X, User, Moon, Sun, Lock, LogOut, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { authService } from '@/services/authService';
import { useNavigate } from 'react-router-dom';
import { overlayVariants, modalVariants } from '@/utils/animations';

interface Props {
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
  const { user, logout }                    = useAuth();
  const { isDark, toggle: toggleTheme }     = useTheme();
  const navigate                            = useNavigate();
  const [open,      setOpen]      = useState(true);
  const [pwForm,    setPwForm]    = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError,   setPwError]   = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showPw,    setShowPw]    = useState({ current: false, next: false, confirm: false });

  const handleClose = () => setOpen(false);

  const handleLogout = async () => {
    handleClose();
    setTimeout(async () => {
      await logout();
      navigate('/login');
    }, 200);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match'); return; }
    if (pwForm.next.length < 6)         { setPwError('Password must be at least 6 characters'); return; }
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

  const pwFields: { key: 'current' | 'next' | 'confirm'; label: string; autocomplete: string }[] = [
    { key: 'current', label: 'Current password',     autocomplete: 'current-password' },
    { key: 'next',    label: 'New password',         autocomplete: 'new-password'     },
    { key: 'confirm', label: 'Confirm new password', autocomplete: 'new-password'     },
  ];

  return (
    <AnimatePresence onExitComplete={onClose}>
      {open && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
          style={{ background: 'rgba(15,10,40,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={handleClose}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="glass-strong w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/40 flex-shrink-0">
              <h2 className="text-base font-bold text-slate-800">Settings</h2>
              <button
                onClick={handleClose}
                className="btn-icon w-8 h-8 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100/60"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-6 scrollbar-none">

              {/* ── Account ── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <User size={13} className="text-indigo-500" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Account</h3>
                </div>
                <div className="glass rounded-2xl overflow-hidden">
                  {[
                    { label: 'Name',  value: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() },
                    { label: 'Email', value: user?.email ?? '' },
                    ...(user?.lastLogin ? [{
                      label: 'Last login',
                      value: new Date(user.lastLogin).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
                    }] : []),
                  ].map((row, i, arr) => (
                    <div
                      key={row.label}
                      className={`flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? 'border-b border-white/40' : ''}`}
                    >
                      <span className="text-xs font-semibold text-slate-500">{row.label}</span>
                      <span className="text-xs text-slate-700 font-medium text-right max-w-[60%] truncate">{row.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Appearance ── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">
                    {isDark ? <Moon size={13} className="text-indigo-500" /> : <Sun size={13} className="text-indigo-500" />}
                  </div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Appearance</h3>
                </div>
                <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Dark Mode</p>
                    <p className="text-xs text-slate-400 mt-0.5">Switch between light and dark theme</p>
                  </div>
                  <motion.button
                    onClick={toggleTheme}
                    aria-label="Toggle dark mode"
                    className={`relative flex-shrink-0 rounded-full ${isDark ? 'bg-gradient-to-r from-indigo-500 to-violet-600' : 'bg-slate-200'}`}
                    style={{ width: 44, height: 24 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.span
                      layout
                      transition={{ type: 'spring', damping: 22, stiffness: 350 }}
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm ${isDark ? 'left-[22px]' : 'left-[2px]'}`}
                    />
                  </motion.button>
                </div>
              </section>

              {/* ── Security ── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Lock size={13} className="text-indigo-500" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Security</h3>
                </div>
                <div className="glass rounded-2xl p-4">
                  <p className="text-xs text-slate-400 mb-4">Change your account password</p>
                  <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                    {pwFields.map(f => (
                      <div key={f.key} className="relative">
                        <input
                          type={showPw[f.key] ? 'text' : 'password'}
                          placeholder={f.label}
                          value={pwForm[f.key]}
                          onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                          disabled={pwLoading}
                          autoComplete={f.autocomplete}
                          className="input-glass pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(s => ({ ...s, [f.key]: !s[f.key] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          tabIndex={-1}
                        >
                          {showPw[f.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    ))}

                    {pwError && <p className="text-xs text-red-600 px-1">{pwError}</p>}
                    {pwSuccess && (
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle size={14} />
                        <p className="text-xs font-medium">Password changed successfully!</p>
                      </div>
                    )}

                    <motion.button
                      type="submit"
                      disabled={pwLoading || !pwForm.current || !pwForm.next || !pwForm.confirm}
                      className="btn-primary disabled:opacity-50 mt-1"
                      style={{ minHeight: 40 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {pwLoading ? (
                        <span className="flex items-center gap-2 justify-center">
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Updating…
                        </span>
                      ) : 'Change Password'}
                    </motion.button>
                  </form>
                </div>
              </section>

              {/* ── Log Out ── */}
              <section className="pb-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center">
                    <LogOut size={13} className="text-red-500" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Account Actions</h3>
                </div>
                <motion.button
                  onClick={handleLogout}
                  className="w-full rounded-xl font-semibold text-sm text-red-600 border border-red-200/60 bg-red-50/60 hover:bg-red-100/80 flex items-center justify-center gap-2"
                  style={{ minHeight: 44 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <LogOut size={15} />
                  Log Out
                </motion.button>
              </section>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
