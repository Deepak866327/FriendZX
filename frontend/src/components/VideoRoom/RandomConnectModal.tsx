import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { RC_WS_PATH } from '@/utils/constants';
import { storage } from '@/utils/storage';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

type Phase = 'connecting' | 'waiting' | 'matched' | 'in-call';

interface RandomConnectModalProps {
  displayName: string;
  onClose: () => void;
}

export const RandomConnectModal: React.FC<RandomConnectModalProps> = ({ displayName, onClose }) => {
  const socketRef      = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const pendingCands   = useRef<RTCIceCandidateInit[]>([]);
  const partnerIdRef   = useRef<string>('');

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [phase,       setPhase]      = useState<Phase>('connecting');
  const [partnerName, setPartnerName] = useState('');
  const [isMuted,     setIsMuted]    = useState(false);
  const [isCamOff,    setIsCamOff]   = useState(false);
  const [error,       setError]      = useState('');

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    pendingCands.current = [];
    partnerIdRef.current = '';
  }, []);

  const handleLeave = useCallback(() => {
    socketRef.current?.emit('randconn:leave');
    socketRef.current?.disconnect();
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  const createPC = useCallback((partnerId: string): RTCPeerConnection => {
    pcRef.current?.close();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate)
        socketRef.current?.emit('randconn:ice', { toUserId: partnerId, candidate: e.candidate.toJSON() });
    };

    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setPhase('in-call');
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        setPhase('waiting');
        setPartnerName('');
      }
    };

    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    pcRef.current = pc;
    return pc;
  }, []);

  const drainCands = useCallback(async (pc: RTCPeerConnection) => {
    const q = pendingCands.current.splice(0);
    for (const c of q) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Get media first
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: true,
        });
      } catch {
        setError('Camera/microphone access denied.');
        return;
      }
      if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const userId = storage.getUser()?.id;
      const socket = io({ path: RC_WS_PATH, query: { userId }, transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('randconn:join', { displayName });
      });

      socket.on('randconn:waiting', () => {
        if (mounted) setPhase('waiting');
      });

      socket.on('randconn:matched', async (data: { partnerId: string; partnerName: string; role: 'caller' | 'callee' }) => {
        if (!mounted) return;
        partnerIdRef.current = data.partnerId;
        setPartnerName(data.partnerName);
        setPhase('matched');

        const pc = createPC(data.partnerId);

        if (data.role === 'caller') {
          // We initiate — create and send offer
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('randconn:offer', { toUserId: data.partnerId, sdp: offer });
          } catch { setPhase('waiting'); }
        }
        // callee waits for the offer
      });

      socket.on('randconn:offer', async (data: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
        const pc = pcRef.current || createPC(data.fromUserId);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await drainCands(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('randconn:answer', { toUserId: data.fromUserId, sdp: answer });
        } catch {}
      });

      socket.on('randconn:answer', async (data: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
        const pc = pcRef.current;
        if (!pc) return;
        try { await pc.setRemoteDescription(new RTCSessionDescription(data.sdp)); await drainCands(pc); } catch {}
      });

      socket.on('randconn:ice', async (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
        const pc = pcRef.current;
        if (!pc || !pc.remoteDescription) { pendingCands.current.push(data.candidate); return; }
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
      });

      socket.on('randconn:partner-left', () => {
        if (!mounted) return;
        pcRef.current?.close();
        pcRef.current = null;
        pendingCands.current = [];
        partnerIdRef.current = '';
        setPartnerName('');
        setPhase('waiting');
        // Auto re-queue
        socket.emit('randconn:join', { displayName });
      });
    })();

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };
  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCamOff(c => !c);
  };

  return (
    <div className="vroom-overlay">
      <div className="vroom-header">
        <span className="vroom-title">🎲 Random Connect</span>
        {phase === 'in-call' && partnerName && (
          <span className="vroom-count">Connected with {partnerName}</span>
        )}
      </div>

      {error ? (
        <div className="vroom-error"><p>{error}</p><button className="btn btn-secondary" onClick={handleLeave}>Leave</button></div>
      ) : (
        <div className={`vroom-grid ${phase === 'in-call' ? 'vroom-grid--2' : 'vroom-grid--1'}`}>
          {/* Local video — always shown */}
          <div className="vroom-tile vroom-tile--local">
            <video ref={localVideoRef} autoPlay playsInline muted className="vroom-video" />
            <div className="vroom-tile__label">You {isMuted && '🔇'}{isCamOff && ' 🚫'}</div>
          </div>

          {/* Remote — only in-call */}
          {phase === 'in-call' && (
            <div className="vroom-tile">
              <video ref={remoteVideoRef} autoPlay playsInline className="vroom-video" />
              <div className="vroom-tile__label">{partnerName}</div>
            </div>
          )}

          {/* Waiting overlay */}
          {(phase === 'connecting' || phase === 'waiting') && (
            <div className="randconn-waiting">
              <div className="randconn-waiting__spinner" />
              <p className="randconn-waiting__title">
                {phase === 'connecting' ? 'Setting up…' : 'Looking for someone…'}
              </p>
              <p className="randconn-waiting__sub">
                {phase === 'waiting'
                  ? 'You\'ll be connected with a random person as soon as one is available'
                  : 'Getting your camera ready'}
              </p>
            </div>
          )}

          {/* Matched but WebRTC not yet connected */}
          {phase === 'matched' && (
            <div className="randconn-waiting">
              <div className="randconn-waiting__spinner randconn-waiting__spinner--green" />
              <p className="randconn-waiting__title">Matched with {partnerName}!</p>
              <p className="randconn-waiting__sub">Establishing connection…</p>
            </div>
          )}
        </div>
      )}

      <div className="vroom-controls">
        <button className={`vroom-ctrl ${isMuted ? 'vroom-ctrl--active' : ''}`} onClick={toggleMute}>{isMuted ? '🔇' : '🎤'}</button>
        <button className={`vroom-ctrl ${isCamOff ? 'vroom-ctrl--active' : ''}`} onClick={toggleCam}>{isCamOff ? '📵' : '📹'}</button>
        <button className="vroom-ctrl vroom-ctrl--end" onClick={handleLeave}>📵 Leave</button>
      </div>
    </div>
  );
};
