import React, { useEffect, useRef, useState } from 'react';
import { useCallContext } from '@/context/CallContext';

export const CallOverlay: React.FC = () => {
  const { call, acceptCall, declineCall, endCall } = useCallContext();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && call?.localStream) {
      localVideoRef.current.srcObject = call.localStream;
    }
  }, [call?.localStream]);

  useEffect(() => {
    if (!call?.remoteStream) return;
    if (call.callType === 'video' && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = call.remoteStream;
    } else if (call.callType === 'audio' && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = call.remoteStream;
    }
  }, [call?.remoteStream, call?.callType]);

  const toggleMute = () => {
    call?.localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };

  const toggleCamera = () => {
    call?.localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOff(c => !c);
  };

  const peerInitial = (name: string) => name.charAt(0).toUpperCase();

  if (!call) return null;

  // ── Waiting for approval ───────────────────────────────────────────────────
  if (call.status === 'requesting') {
    return (
      <div className="call-overlay">
        <div className="call-card">
          <div className="call-avatar">{peerInitial(call.peerName)}</div>
          <div className="call-peer-name">{call.peerName}</div>
          <div className="call-status-text">Waiting for approval…</div>
          <div className="call-status-sub">Sending call request</div>
          <div className="call-actions">
            <button className="call-btn call-btn-end" onClick={declineCall}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Outgoing ring ──────────────────────────────────────────────────────────
  if (call.status === 'ringing-outgoing') {
    return (
      <div className="call-overlay call-overlay-dark">
        {call.callType === 'video' && call.localStream && (
          <video ref={localVideoRef} autoPlay playsInline muted className="call-local-preview-large" />
        )}
        <div className="call-ring-info">
          <div className="call-avatar-lg">{peerInitial(call.peerName)}</div>
          <div className="call-peer-name-lg">{call.peerName}</div>
          <div className="call-status-text-lg">
            {call.callType === 'video' ? '📹' : '📞'} Calling…
          </div>
        </div>
        <div className="call-controls">
          <button className="call-ctrl call-ctrl-end" onClick={declineCall} title="Cancel">📵</button>
        </div>
      </div>
    );
  }

  // ── Incoming ring (accept/decline) ────────────────────────────────────────
  if (call.status === 'ringing-incoming') {
    return (
      <div className="call-overlay">
        <div className="call-card">
          <div className="call-avatar call-avatar-pulse">{peerInitial(call.peerName)}</div>
          <div className="call-peer-name">{call.peerName}</div>
          <div className="call-status-text">
            {call.callType === 'video' ? '📹 Incoming video call' : '📞 Incoming audio call'}
          </div>
          <div className="call-actions">
            <button className="call-btn call-btn-decline" onClick={declineCall}>Decline</button>
            <button className="call-btn call-btn-accept" onClick={acceptCall}>Accept</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Connecting / Active call ───────────────────────────────────────────────
  if (call.status === 'connecting' || call.status === 'active') {
    const isVideo = call.callType === 'video';
    return (
      <div className="call-overlay call-overlay-full">
        {isVideo ? (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="call-remote-video" />
            <video ref={localVideoRef} autoPlay playsInline muted className="call-local-video" />
          </>
        ) : (
          <div className="call-audio-bg">
            <audio ref={remoteAudioRef} autoPlay />
            <div className="call-avatar-xl">{peerInitial(call.peerName)}</div>
            <div className="call-peer-name-xl">{call.peerName}</div>
          </div>
        )}
        <div className="call-status-bar">
          {call.status === 'connecting' ? '⏳ Connecting…' : '🟢 Connected'}
        </div>
        <div className="call-controls call-controls-active">
          <button
            className={`call-ctrl ${isMuted ? 'call-ctrl-on' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          {isVideo && (
            <button
              className={`call-ctrl ${isCameraOff ? 'call-ctrl-on' : ''}`}
              onClick={toggleCamera}
              title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isCameraOff ? '🚫' : '📹'}
            </button>
          )}
          <button className="call-ctrl call-ctrl-end" onClick={endCall} title="End call">
            📵
          </button>
        </div>
      </div>
    );
  }

  return null;
};
