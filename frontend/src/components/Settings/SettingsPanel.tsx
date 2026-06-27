import React, { useState } from 'react';
import {
  Mail, Hash, Bell, BellRing, MapPin, Activity, Lock,
  Trash2, LogOut, Check, Save, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { staggerListVariants, staggerItemVariants } from '@/utils/animations';

/* ── Reusable pill toggle ─────────────────────────────────────── */
const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
      checked
        ? 'bg-gradient-to-r from-indigo-500 to-violet-500 shadow-md shadow-indigo-200/60'
        : 'bg-slate-200'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

/* ── Setting row with toggle ──────────────────────────────────── */
const ToggleRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}> = ({ icon, label, description, checked, onChange }) => (
  <div className="flex items-center gap-3 px-4 py-3.5">
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center text-indigo-500 flex-shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-slate-800">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

/* ── Info row (read-only) ─────────────────────────────────────── */
const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string | undefined }> = ({
  icon, label, value,
}) => (
  <div className="flex items-center gap-3 px-4 py-3.5">
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center text-indigo-500 flex-shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-700 truncate mt-0.5">{value || '—'}</p>
    </div>
  </div>
);

/* ── Section wrapper ──────────────────────────────────────────── */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">{title}</p>
    <div className="glass rounded-2xl overflow-hidden divide-y divide-white/30">
      {children}
    </div>
  </div>
);

/* ── Main component ───────────────────────────────────────────── */
export const SettingsPanel: React.FC = () => {
  const { user, logout }                       = useAuth();
  const { isTracking, startTracking, stopTracking } = useLocation();

  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications:  true,
    shareActivity:      true,
    privateProfile:     false,
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const toggle = (key: keyof typeof settings) =>
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const handleLocationToggle = () => {
    isTracking ? stopTracking() : startTracking();
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    await new Promise(r => setTimeout(r, 500));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  return (
    <motion.div
      className="w-full max-w-lg mx-auto px-4 py-6 space-y-4 pb-safe"
      variants={staggerListVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Account */}
      <motion.div variants={staggerItemVariants}>
        <Section title="Account">
          <InfoRow icon={<Mail size={15} />} label="Email"   value={user?.email} />
          <InfoRow icon={<Hash size={15} />} label="User ID" value={user?.id}    />
        </Section>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={staggerItemVariants}>
        <Section title="Notifications">
          <ToggleRow
            icon={<Bell size={15} />}
            label="Email Notifications"
            description="Receive updates and alerts by email"
            checked={settings.emailNotifications}
            onChange={() => toggle('emailNotifications')}
          />
          <ToggleRow
            icon={<BellRing size={15} />}
            label="Push Notifications"
            description="Browser push notifications"
            checked={settings.pushNotifications}
            onChange={() => toggle('pushNotifications')}
          />
        </Section>
      </motion.div>

      {/* Location & Privacy */}
      <motion.div variants={staggerItemVariants}>
        <Section title="Location & Privacy">
          <ToggleRow
            icon={<MapPin size={15} />}
            label="Location Tracking"
            description="Track your location for nearby users"
            checked={isTracking}
            onChange={handleLocationToggle}
          />
          <ToggleRow
            icon={<Activity size={15} />}
            label="Share Activity"
            description="Share your activity with followers"
            checked={settings.shareActivity}
            onChange={() => toggle('shareActivity')}
          />
          <ToggleRow
            icon={<Lock size={15} />}
            label="Private Profile"
            description="Only followers can see your profile"
            checked={settings.privateProfile}
            onChange={() => toggle('privateProfile')}
          />
        </Section>
      </motion.div>

      {/* Danger zone */}
      <motion.div variants={staggerItemVariants}>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">Danger Zone</p>
        <div className="rounded-2xl overflow-hidden border border-rose-200/60 bg-rose-50/40 backdrop-blur-sm divide-y divide-rose-100/60">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-500 flex-shrink-0">
              <AlertTriangle size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-rose-700">Delete Account</p>
              <p className="text-xs text-rose-400 mt-0.5">Permanently remove your account and data</p>
            </div>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-100 hover:bg-rose-200 transition-colors">
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div variants={staggerItemVariants} className="flex flex-col gap-3 pt-2">
        <button
          className="btn-primary w-full gap-2"
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? (
            <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : saveStatus === 'saved' ? (
            <><Check size={16} /> Saved!</>
          ) : (
            <><Save size={16} /> Save Settings</>
          )}
        </button>

        <button
          className="btn-secondary w-full gap-2"
          onClick={() => logout()}
        >
          <LogOut size={16} />
          Log Out
        </button>
      </motion.div>
    </motion.div>
  );
};
