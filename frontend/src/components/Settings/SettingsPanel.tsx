import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';

export const SettingsPanel: React.FC = () => {
  const { user, logout } = useAuth();
  const { isTracking, startTracking, stopTracking } = useLocation();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    locationTracking: false,
    shareActivity: true,
    privateProfile: false,
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleToggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleLocationTrackingToggle = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
    handleToggleSetting('locationTracking');
  };

  const handleSaveSettings = async () => {
    try {
      setSaveStatus('saving');
      // API call to save settings
      await new Promise(resolve => setTimeout(resolve, 500));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h3>Account</h3>
          <div className="setting-item">
            <div className="setting-label">
              <p className="label">Email</p>
              <p className="description">{user?.email}</p>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-label">
              <p className="label">User ID</p>
              <p className="description">{user?.id}</p>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h3>Notifications</h3>
          <div className="setting-item">
            <div className="setting-label">
              <p className="label">Email Notifications</p>
              <p className="description">Receive email updates</p>
            </div>
            <div className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={() => handleToggleSetting('emailNotifications')}
              />
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-label">
              <p className="label">Push Notifications</p>
              <p className="description">Browser push notifications</p>
            </div>
            <div className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.pushNotifications}
                onChange={() => handleToggleSetting('pushNotifications')}
              />
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h3>Location & Privacy</h3>
          <div className="setting-item">
            <div className="setting-label">
              <p className="label">Location Tracking</p>
              <p className="description">Track your location for nearby users</p>
            </div>
            <div className="setting-toggle">
              <input
                type="checkbox"
                checked={isTracking}
                onChange={handleLocationTrackingToggle}
              />
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-label">
              <p className="label">Share Activity</p>
              <p className="description">Share your activity with followers</p>
            </div>
            <div className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.shareActivity}
                onChange={() => handleToggleSetting('shareActivity')}
              />
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-label">
              <p className="label">Private Profile</p>
              <p className="description">Only followers can see your profile</p>
            </div>
            <div className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.privateProfile}
                onChange={() => handleToggleSetting('privateProfile')}
              />
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h3>Danger Zone</h3>
          <div className="setting-item danger">
            <div className="setting-label">
              <p className="label">Delete Account</p>
              <p className="description">Permanently delete your account</p>
            </div>
            <button className="btn btn-danger btn-sm">Delete</button>
          </div>
        </section>

        <div className="settings-actions">
          <button
            className="btn btn-primary"
            onClick={handleSaveSettings}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? 'Saving...' : 'Save Settings'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => logout()}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};