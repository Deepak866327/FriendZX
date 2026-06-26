import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLocation as useLocationContext } from '@/hooks/useLocation';
import { useBluetooth } from '@/context/BluetoothContext';
import { LocationTracker } from '@/components/Location/LocationTracker';
import { NearbyUsers } from '@/components/Location/NearbyUsers';
import { BluetoothDiscovery } from '@/components/Bluetooth/BluetoothDiscovery';
import { CrationFeed } from '@/components/Cration/CrationFeed';
import { CreateCrationModal } from '@/components/Cration/CreateCrationModal';
import { StartRandomCallModal } from '@/components/VideoRoom/StartRandomCallModal';
import { VideoRoomModal } from '@/components/VideoRoom/VideoRoomModal';
import { RandomConnectModal } from '@/components/VideoRoom/RandomConnectModal';
import { VideoRoom } from '@/services/videoRoomService';

// Only show on these routes
const ALLOWED_ROUTES = ['/dashboard', '/profile'];

export const BottomActionBar: React.FC = () => {
  const routerLocation  = useRouterLocation();
  const navigate        = useNavigate();
  const { user }        = useAuth();
  const { isTracking }  = useLocationContext();
  const { isDiscovering } = useBluetooth();

  const [userLocation, setUserLocation]         = useState<{ latitude: number; longitude: number } | null>(null);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [showBtSheet, setShowBtSheet]             = useState(false);
  const [showCrationFeed, setShowCrationFeed]     = useState(false);
  const [showCreateCration, setShowCreateCration] = useState(false);
  const [showRCPicker, setShowRCPicker]           = useState(false);
  const [showStartCall, setShowStartCall]         = useState(false);
  const [showRandomConnect, setShowRandomConnect] = useState(false);
  const [activeRoom, setActiveRoom]               = useState<VideoRoom | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {}
    );
  }, []);

  // Only render on allowed routes
  if (!ALLOWED_ROUTES.includes(routerLocation.pathname)) return null;

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'User'
    : 'User';

  return (
    <>
      {/* ── Bottom action bar ──────────────────────────────────────── */}
      <div className="home-action-bar">
        <button
          className={`home-action-btn${isTracking ? ' home-action-btn--active' : ''}`}
          onClick={() => setShowLocationSheet(true)}
          title="Location"
        >
          <span className="home-action-icon">📍</span>
          {isTracking && <span className="home-action-dot" />}
        </button>

        <button
          className={`home-action-btn${isDiscovering ? ' home-action-btn--active' : ''}`}
          onClick={() => setShowBtSheet(true)}
          title="Bluetooth"
        >
          {/* Android-style Bluetooth icon */}
          <span className="home-action-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/>
            </svg>
          </span>
          {isDiscovering && <span className="home-action-dot" />}
        </button>

        <button className="home-action-btn" onClick={() => navigate('/explore')} title="Explore">
          <span className="home-action-icon">🔍</span>
        </button>

        <button
          className="home-action-btn home-action-btn--cration"
          onClick={() => setShowCrationFeed(true)}
          title="Cration"
        >
          <span className="home-action-icon">🎬</span>
        </button>

        <button
          className={`home-action-btn${(activeRoom || showRandomConnect) ? ' home-action-btn--active' : ''}`}
          onClick={() => setShowRCPicker(true)}
          title="Random Connect"
        >
          <span className="home-action-icon">🎲</span>
          {(activeRoom || showRandomConnect) && <span className="home-action-dot" />}
        </button>
      </div>

      {/* ── Location sheet ─────────────────────────────────────────── */}
      {showLocationSheet && (
        <div className="sheet-overlay" onClick={() => setShowLocationSheet(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>📍 Location Tracking</h3>
              <button className="modal-close" onClick={() => setShowLocationSheet(false)}>✕</button>
            </div>
            <div className="sheet-body">
              <LocationTracker />
              <div style={{ marginTop: '16px' }}>
                <NearbyUsers />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bluetooth sheet ────────────────────────────────────────── */}
      {showBtSheet && (
        <div className="sheet-overlay" onClick={() => setShowBtSheet(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>📶 Bluetooth Discovery</h3>
              <button className="modal-close" onClick={() => setShowBtSheet(false)}>✕</button>
            </div>
            <div className="sheet-body">
              <BluetoothDiscovery />
            </div>
          </div>
        </div>
      )}

      {/* ── Random Connect picker ──────────────────────────────────── */}
      {showRCPicker && (
        <div className="modal-overlay" onClick={() => setShowRCPicker(false)}>
          <div className="rc-picker" onClick={e => e.stopPropagation()}>
            <div className="rc-picker__header">
              <button className="modal-close" onClick={() => setShowRCPicker(false)}>✕</button>
              <span className="rc-picker__title">✨ Random Connect</span>
              <span className="rc-picker__subtitle">Choose how you want to connect</span>
            </div>
            <div className="rc-picker__options">
              <button
                className="rc-picker__option"
                onClick={() => { setShowRCPicker(false); setShowStartCall(true); }}
              >
                <span className="rc-picker__option-icon">📹</span>
                <div className="rc-picker__option-body">
                  <span className="rc-picker__option-title">Nearby Video Call</span>
                  <span className="rc-picker__option-desc">Start a room visible to people within your chosen radius</span>
                </div>
                <span className="rc-picker__option-arrow">›</span>
              </button>
              <button
                className="rc-picker__option"
                onClick={() => { setShowRCPicker(false); setShowRandomConnect(true); }}
              >
                <span className="rc-picker__option-icon">🎲</span>
                <div className="rc-picker__option-body">
                  <span className="rc-picker__option-title">Random Call</span>
                  <span className="rc-picker__option-desc">Get matched 1-on-1 with a random person from anywhere</span>
                </div>
                <span className="rc-picker__option-arrow">›</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showStartCall && (
        <StartRandomCallModal
          userLocation={userLocation}
          displayName={displayName}
          onClose={() => setShowStartCall(false)}
          onStarted={room => { setShowStartCall(false); setActiveRoom(room); }}
        />
      )}

      {activeRoom && (
        <VideoRoomModal
          room={activeRoom}
          currentUserId={user?.id ?? ''}
          displayName={displayName}
          onClose={() => setActiveRoom(null)}
        />
      )}

      {showRandomConnect && (
        <RandomConnectModal
          displayName={displayName}
          onClose={() => setShowRandomConnect(false)}
        />
      )}

      {showCrationFeed && (
        <CrationFeed
          onClose={() => setShowCrationFeed(false)}
          onCreateNew={() => { setShowCrationFeed(false); setShowCreateCration(true); }}
        />
      )}

      {showCreateCration && (
        <CreateCrationModal
          onClose={() => setShowCreateCration(false)}
          onCreated={() => setShowCreateCration(false)}
        />
      )}
    </>
  );
};
