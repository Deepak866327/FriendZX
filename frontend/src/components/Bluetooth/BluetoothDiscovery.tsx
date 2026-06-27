import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Phone, Video, Zap, Copy, Check, RefreshCw, Bluetooth, Radio, X } from 'lucide-react';
import { useBluetooth, BtUser } from '@/context/BluetoothContext';
import { useCallContext } from '@/context/CallContext';
import { userService } from '@/services/userService';
import { ChatModal } from '@/components/Chat/ChatModal';
import { FriendChallengeModal } from '@/components/Challenge/FriendChallengeModal';
import { PublicProfile } from '@/types/api';
import challengeService from '@/services/challengeService';

const GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-purple-600',
  'from-sky-400 to-blue-500',
  'from-pink-500 to-rose-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
];
function avatarGradient(uid: string) {
  const n = uid.charCodeAt(0) + uid.charCodeAt(uid.length - 1);
  return GRADIENTS[n % GRADIENTS.length];
}

export const BluetoothDiscovery: React.FC = () => {
  const {
    isDiscovering, isConnected, isBluetoothMode, bleScanActive,
    nearbyUsers, pairingCode, pairError,
    startDiscovery, stopDiscovery, updateBeacon,
    submitPairingCode, refreshPairingCode, clearPairError,
  } = useBluetooth();
  const { initiateCall } = useCallContext();

  const [radiusM,         setRadiusM]         = useState(50);
  const [codeInput,       setCodeInput]       = useState('');
  const [codeCopied,      setCodeCopied]      = useState(false);
  const [chatTarget,      setChatTarget]      = useState<PublicProfile | null>(null);
  const [challengeTarget, setChallengeTarget] = useState<{ id: string; name: string } | null>(null);
  const watchIdRef = useRef<number>();

  useEffect(() => {
    if (!isDiscovering || isBluetoothMode) {
      if (watchIdRef.current !== undefined) navigator.geolocation.clearWatch(watchIdRef.current);
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => updateBeacon(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => {
      if (watchIdRef.current !== undefined) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isDiscovering, isBluetoothMode, updateBeacon]);

  const handleOpenChat = async (userId: string) => {
    try {
      setChatTarget(await userService.getPublicProfile(userId));
    } catch {
      setChatTarget({ userId, interests: [], photos: [], followers: 0, following: 0 });
    }
  };

  const handleCall = async (userId: string, type: 'audio' | 'video') => {
    try { initiateCall(await userService.getPublicProfile(userId), type); } catch {}
  };

  const handleChallenge = async (userId: string, displayName: string) => {
    try {
      await challengeService.createFriendChallenge(userId);
      setChallengeTarget({ id: userId, name: displayName });
    } catch {}
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
      <div className="flex flex-col gap-4">

        {/* ── Header card ── */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all ${
                isDiscovering
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-glass'
                  : 'bg-slate-200'
              }`}
            >
              {isBluetoothMode ? <Bluetooth size={18} /> : <Radio size={18} />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 text-sm">
                  {isBluetoothMode ? 'Bluetooth Proximity' : 'GPS Proximity'}
                </h3>
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-emerald-400' : 'bg-slate-300'}`}
                  title={isConnected ? 'Connected' : 'Disconnected'}
                />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isBluetoothMode
                  ? 'Discover people by Bluetooth — no GPS required'
                  : `Discover people within ${radiusM}m`}
              </p>
            </div>
          </div>

          {/* BLE banner */}
          {isBluetoothMode && bleScanActive && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200/60 mt-3">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
              <span className="text-xs text-indigo-600 font-medium">Scanning Bluetooth signals automatically…</span>
            </div>
          )}
        </div>

        {/* ── Radar + controls card ── */}
        <div className="glass rounded-2xl p-6 flex flex-col items-center gap-5">

          {/* Radar circle */}
          <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
            {/* Rings */}
            <div className="absolute inset-0 rounded-full border border-indigo-200/60" />
            <div className="absolute rounded-full border border-indigo-200/40" style={{ inset: '-20px' }} />
            <div className="absolute rounded-full border border-indigo-200/20" style={{ inset: '-40px' }} />

            {/* Animated pulse rings (only when discovering) */}
            {isDiscovering && (
              <>
                <div
                  className="absolute inset-0 rounded-full border border-indigo-400/50"
                  style={{ animation: 'pulse-ring 2s ease-out infinite', animationDelay: '0s' }}
                />
                <div
                  className="absolute inset-0 rounded-full border border-violet-400/40"
                  style={{ animation: 'pulse-ring 2s ease-out infinite', animationDelay: '0.7s' }}
                />
                <div
                  className="absolute inset-0 rounded-full border border-sky-400/30"
                  style={{ animation: 'pulse-ring 2s ease-out infinite', animationDelay: '1.4s' }}
                />
              </>
            )}

            {/* Center icon */}
            <div
              className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ${
                isDiscovering
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-glass text-white'
                  : 'bg-white/80 text-slate-400 border border-white/60'
              }`}
            >
              {isBluetoothMode
                ? <Bluetooth size={24} />
                : <Radio size={24} />}
            </div>
          </div>

          {/* Count */}
          <p className="text-sm font-semibold text-slate-600">
            {isDiscovering
              ? nearbyUsers.length === 0 ? 'Scanning…' : `${nearbyUsers.length} found nearby`
              : 'Discovery is off'}
          </p>

          {/* Radius picker — GPS mode, not discovering */}
          {!isDiscovering && !isBluetoothMode && (
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span className="text-xs text-slate-400 font-medium">Range:</span>
              {[10, 25, 50, 100, 200].map(r => (
                <button
                  key={r}
                  onClick={() => setRadiusM(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    radiusM === r
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white'
                      : 'glass text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  {r}m
                </button>
              ))}
            </div>
          )}

          {/* Toggle button */}
          <button
            onClick={() => isDiscovering ? stopDiscovery() : startDiscovery(radiusM)}
            disabled={!isConnected}
            className={`w-full rounded-xl font-semibold text-sm transition-all duration-200 ${
              isDiscovering
                ? 'bg-red-50 text-red-600 border border-red-200/60 hover:bg-red-100 active:scale-95'
                : 'btn-primary'
            }`}
            style={{ minHeight: 44 }}
          >
            {!isConnected ? 'Connecting…' : isDiscovering ? 'Stop Discovery' : 'Start Discovery'}
          </button>
        </div>

        {/* ── Bluetooth pairing panel ── */}
        {isDiscovering && isBluetoothMode && (
          <div className="glass rounded-2xl p-5 flex flex-col gap-5">

            {/* Your code */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Your Bluetooth Code</p>
              <p className="text-xs text-slate-400 mb-3">Show this to someone nearby — they type it on their device</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 glass rounded-xl px-4 py-3 text-center">
                  <span className="text-2xl font-black tracking-[0.35em] gradient-text">
                    {pairingCode ?? '------'}
                  </span>
                </div>
                <button
                  onClick={handleCopyCode}
                  className={`btn-icon w-10 h-10 rounded-xl ${codeCopied ? 'text-emerald-500 bg-emerald-50' : 'glass text-slate-500'}`}
                  title="Copy code"
                >
                  {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <button
                  onClick={refreshPairingCode}
                  className="btn-icon w-10 h-10 rounded-xl glass text-slate-500 hover:text-indigo-500"
                  title="New code"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium px-2">or enter theirs</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Enter peer's code */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Enter Their Code</p>
              <p className="text-xs text-slate-400 mb-3">Ask the person nearby for their 6-character code</p>

              {pairError && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200/60 mb-3">
                  <p className="text-xs text-red-600">{pairError}</p>
                  <button onClick={clearPairError} className="text-red-400 hover:text-red-600">
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="A3K9Z7"
                  maxLength={6}
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleSubmitCode()}
                  className="input-glass flex-1 text-center text-base font-bold tracking-[0.3em] uppercase"
                />
                <button
                  onClick={handleSubmitCode}
                  disabled={codeInput.length < 6}
                  className="btn-primary px-4 flex-shrink-0"
                  style={{ minHeight: 44 }}
                >
                  Connect
                </button>
              </div>
            </div>

            {!bleScanActive && (
              <p className="text-xs text-slate-400 text-center">
                💡 Automatic detection requires Chrome with Bluetooth permission enabled
              </p>
            )}
          </div>
        )}

        {/* ── Nearby users list ── */}
        {isDiscovering && nearbyUsers.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Found {nearbyUsers.length} {nearbyUsers.length === 1 ? 'person' : 'people'}
            </p>
            {nearbyUsers.map(u => (
              <BtUserRow
                key={u.userId}
                user={u}
                onChat={() => handleOpenChat(u.userId)}
                onAudioCall={() => handleCall(u.userId, 'audio')}
                onVideoCall={() => handleCall(u.userId, 'video')}
                onChallenge={() => handleChallenge(u.userId, u.displayName)}
              />
            ))}
          </div>
        )}

        {isDiscovering && nearbyUsers.length === 0 && !isBluetoothMode && (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-sm text-slate-400">No one nearby yet. Keep scanning…</p>
          </div>
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

/* ── BT user row ── */
const BtUserRow: React.FC<{
  user: BtUser;
  onChat: () => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
  onChallenge: () => void;
}> = ({ user, onChat, onAudioCall, onVideoCall, onChallenge }) => {
  const GRADIENTS = [
    'from-indigo-500 to-violet-600',
    'from-violet-500 to-purple-600',
    'from-sky-400 to-blue-500',
    'from-pink-500 to-rose-500',
  ];
  const grad = GRADIENTS[user.userId.charCodeAt(0) % GRADIENTS.length];

  return (
    <div className="glass-hover rounded-2xl p-4 flex items-center gap-3">
      {/* Avatar */}
      <div
        className={`w-11 h-11 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
      >
        {user.avatarInitial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{user.displayName}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {user.bluetoothPaired
            ? <span className="text-indigo-500 font-medium">Connected via Bluetooth</span>
            : user.noGps
              ? 'Bluetooth nearby'
              : `${user.distanceM}m away`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={onChat}      className="btn-icon w-8 h-8 rounded-lg text-slate-500 hover:text-indigo-500 hover:bg-indigo-50" title="Chat"><MessageCircle size={15} /></button>
        <button onClick={onAudioCall} className="btn-icon w-8 h-8 rounded-lg text-slate-500 hover:text-violet-500 hover:bg-violet-50" title="Audio call"><Phone size={14} /></button>
        <button onClick={onVideoCall} className="btn-icon w-8 h-8 rounded-lg text-slate-500 hover:text-sky-500 hover:bg-sky-50" title="Video call"><Video size={14} /></button>
        <button onClick={onChallenge} className="btn-icon w-8 h-8 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-amber-50" title="Challenge"><Zap size={14} /></button>
      </div>
    </div>
  );
};
