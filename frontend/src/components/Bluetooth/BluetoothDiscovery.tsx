import React, { useEffect, useRef, useState } from 'react';
import { useBluetooth, BtUser } from '@/context/BluetoothContext';
import { useCallContext } from '@/context/CallContext';
import { userService } from '@/services/userService';
import { ChatModal } from '@/components/Chat/ChatModal';
import { FriendChallengeModal } from '@/components/Challenge/FriendChallengeModal';
import { PublicProfile } from '@/types/api';
import challengeService from '@/services/challengeService';

export const BluetoothDiscovery: React.FC = () => {
  const {
    isDiscovering, isConnected, isBluetoothMode, bleScanActive,
    nearbyUsers, pairingCode, pairError,
    startDiscovery, stopDiscovery, updateBeacon,
    submitPairingCode, refreshPairingCode, clearPairError,
  } = useBluetooth();
  const { initiateCall } = useCallContext();

  const [radiusM, setRadiusM]               = useState(50);
  const [codeInput, setCodeInput]           = useState('');
  const [codeCopied, setCodeCopied]         = useState(false);
  const [chatTarget, setChatTarget]         = useState<PublicProfile | null>(null);
  const [challengeTarget, setChallengeTarget] = useState<{ id: string; name: string } | null>(null);
  const watchIdRef = useRef<number>();

  // GPS watchPosition — only when discovering in GPS mode
  useEffect(() => {
    if (!isDiscovering || isBluetoothMode) {
      if (watchIdRef.current !== undefined) navigator.geolocation.clearWatch(watchIdRef.current);
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => updateBeacon(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => {
      if (watchIdRef.current !== undefined) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isDiscovering, isBluetoothMode, updateBeacon]);

  const handleOpenChat = async (userId: string) => {
    try {
      const profile = await userService.getPublicProfile(userId);
      setChatTarget(profile);
    } catch {
      setChatTarget({ userId, interests: [], photos: [], followers: 0, following: 0 });
    }
  };

  const handleCall = async (userId: string, type: 'audio' | 'video') => {
    try {
      const profile = await userService.getPublicProfile(userId);
      initiateCall(profile, type);
    } catch {}
  };

  const handleChallenge = async (userId: string, displayName: string) => {
    try {
      await challengeService.createFriendChallenge(userId);
      setChallengeTarget({ id: userId, name: displayName });
    } catch {
      // show nothing — challenge created, modal will appear
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleSubmitCode = () => {
    if (!codeInput.trim()) return;
    submitPairingCode(codeInput);
    setCodeInput('');
  };

  return (
    <>
      <div className="bt-discovery-box">
        {/* Header */}
        <div className="bt-header">
          <div className="bt-title-row">
            <span className="bt-icon">{isBluetoothMode ? '🔵' : '📡'}</span>
            <h3 className="bt-title">
              {isBluetoothMode ? 'Bluetooth Proximity' : 'Bluetooth Nearby'}
            </h3>
            <span
              className={`bt-status-dot ${isConnected ? 'bt-status-on' : 'bt-status-off'}`}
              title={isConnected ? 'Connected' : 'Disconnected'}
            />
          </div>
          <p className="bt-subtitle">
            {isBluetoothMode
              ? 'Discover people by Bluetooth proximity — no GPS or network required'
              : `Discover people within ${radiusM}m`}
          </p>
        </div>

        {/* BLE auto-scan banner */}
        {isBluetoothMode && bleScanActive && (
          <div className="bt-ble-banner">
            <span className="bt-ble-dot" />
            <span>Scanning Bluetooth signals automatically…</span>
          </div>
        )}

        {/* Radar animation */}
        <div className="bt-radar-wrap">
          <div className={`bt-radar ${isDiscovering ? 'bt-radar-active' : ''}`}>
            <div className="bt-radar-center">
              {isDiscovering
                ? <span style={{ fontSize: 22 }}>{isBluetoothMode ? '🔵' : '📡'}</span>
                : <span style={{ fontSize: 22, opacity: 0.4 }}>📵</span>}
            </div>
            {isDiscovering && (
              <>
                <div className="bt-radar-ring bt-radar-ring-1" />
                <div className="bt-radar-ring bt-radar-ring-2" />
                <div className="bt-radar-ring bt-radar-ring-3" />
              </>
            )}
          </div>
          <div className="bt-radar-count">
            {isDiscovering
              ? nearbyUsers.length === 0 ? 'Scanning…' : `${nearbyUsers.length} found`
              : 'Off'}
          </div>
        </div>

        {/* Radius selector — only in GPS mode */}
        {!isDiscovering && !isBluetoothMode && (
          <div className="bt-radius-row">
            <span className="bt-radius-label">Range</span>
            {[10, 25, 50, 100, 200].map(r => (
              <button
                key={r}
                className={`bt-radius-btn ${radiusM === r ? 'bt-radius-btn-active' : ''}`}
                onClick={() => setRadiusM(r)}
              >
                {r}m
              </button>
            ))}
          </div>
        )}

        {/* Toggle button */}
        <button
          className={`bt-toggle-btn ${isDiscovering ? 'bt-toggle-stop' : 'bt-toggle-start'}`}
          onClick={() => isDiscovering ? stopDiscovery() : startDiscovery(radiusM)}
          disabled={!isConnected}
        >
          {!isConnected ? 'Connecting…' : isDiscovering ? 'Stop Discovery' : 'Start Discovery'}
        </button>

        {/* ── Bluetooth Pairing Panel (shown in BT mode) ─────────────────────── */}
        {isDiscovering && isBluetoothMode && (
          <div className="bt-pair-panel">
            {/* User's own code */}
            <div className="bt-pair-section">
              <p className="bt-pair-label">Your Bluetooth Code</p>
              <p className="bt-pair-hint">Show this to someone nearby — they enter it on their device</p>
              <div className="bt-pair-code-row">
                <span className="bt-pair-code">{pairingCode ?? '------'}</span>
                <button
                  className="bt-pair-copy"
                  onClick={handleCopyCode}
                  title="Copy code"
                >
                  {codeCopied ? '✓' : '📋'}
                </button>
                <button
                  className="bt-pair-refresh"
                  onClick={refreshPairingCode}
                  title="Get a new code"
                >
                  🔄
                </button>
              </div>
            </div>

            <div className="bt-pair-divider">— or —</div>

            {/* Enter peer's code */}
            <div className="bt-pair-section">
              <p className="bt-pair-label">Enter Their Code</p>
              <p className="bt-pair-hint">Ask the nearby person to share their code, then type it here</p>
              {pairError && (
                <div className="bt-pair-error">
                  <span>{pairError}</span>
                  <button onClick={clearPairError}>✕</button>
                </div>
              )}
              <div className="bt-pair-input-row">
                <input
                  className="bt-pair-input"
                  type="text"
                  placeholder="e.g. A3K9Z7"
                  maxLength={6}
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleSubmitCode()}
                />
                <button
                  className="bt-pair-connect"
                  onClick={handleSubmitCode}
                  disabled={codeInput.length < 6}
                >
                  Connect
                </button>
              </div>
            </div>

            {/* BLE auto-discovery hint */}
            {!bleScanActive && (
              <p className="bt-ble-hint">
                💡 Automatic detection requires Chrome with Bluetooth permission enabled
              </p>
            )}
          </div>
        )}

        {/* Nearby user list */}
        {isDiscovering && nearbyUsers.length > 0 && (
          <div className="bt-user-list">
            {nearbyUsers.map(user => (
              <BtUserRow
                key={user.userId}
                user={user}
                onChat={() => handleOpenChat(user.userId)}
                onAudioCall={() => handleCall(user.userId, 'audio')}
                onVideoCall={() => handleCall(user.userId, 'video')}
                onChallenge={() => handleChallenge(user.userId, user.displayName)}
              />
            ))}
          </div>
        )}

        {isDiscovering && nearbyUsers.length === 0 && !isBluetoothMode && (
          <p className="bt-empty">No one nearby yet. Keep scanning…</p>
        )}
      </div>

      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}
      {challengeTarget && (
        <FriendChallengeModal
          challengeId={challengeTarget.id}
          opponentName={challengeTarget.name}
          onClose={() => setChallengeTarget(null)}
        />
      )}
    </>
  );
};

const BtUserRow: React.FC<{
  user: BtUser;
  onChat: () => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
  onChallenge: () => void;
}> = ({ user, onChat, onAudioCall, onVideoCall, onChallenge }) => (
  <div className="bt-user-row">
    <div className="bt-user-avatar">{user.avatarInitial}</div>
    <div className="bt-user-info">
      <p className="bt-user-name">{user.displayName}</p>
      <p className="bt-user-dist">
        {user.bluetoothPaired
          ? '🔵 Connected via Bluetooth'
          : user.noGps
            ? '📶 Bluetooth nearby'
            : `📍 ${user.distanceM}m away`}
      </p>
    </div>
    <div className="bt-user-actions">
      <button className="bt-action-btn" onClick={onChat}       title="Chat">💬</button>
      <button className="bt-action-btn" onClick={onAudioCall}  title="Audio call">📞</button>
      <button className="bt-action-btn" onClick={onVideoCall}  title="Video call">📹</button>
      <button className="bt-action-btn" onClick={onChallenge}  title="Challenge">🎯</button>
    </div>
  </div>
);
