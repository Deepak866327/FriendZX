import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('randconn:offer', { toUserId: data.partnerId, sdp: offer });
          } catch { setPhase('waiting'); }
        }
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
        socket.emit('randconn:join', { displayName });
      });
    })();

    return () => { mounted = false; };
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

  const inCall = phase === 'in-call';

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 pt-safe py-3"
        style={{ background: 'rgba(15,10,40,0.80)', backdropFilter: 'blur(16px)' }}
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
          <Shuffle size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Random Connect</p>
          {inCall && partnerName && (
            <p className="text-[11px] text-white/50 truncate">Connected with {partnerName}</p>
          )}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex-shrink-0 mx-4 mt-2 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-rose-500/20 border border-rose-400/30"
          >
            <p className="text-sm text-rose-300">{error}</p>
            <button
              onClick={handleLeave}
              className="text-xs text-white font-semibold px-3 py-1.5 rounded-xl bg-rose-500/30 hover:bg-rose-500/50 transition-colors"
            >
              Leave
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video grid */}
      {!error && (
        <div className="flex-1 overflow-hidden p-3 relative">
          <div className={`h-full grid gap-3 ${inCall ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Local tile */}
            <div className="relative bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center min-h-[160px]">
              <video ref={localVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-lg glass-dark">
                <span className="text-white text-[11px] font-semibold">You</span>
                {isMuted  && <MicOff   size={9} className="text-rose-400" />}
                {isCamOff && <VideoOff size={9} className="text-rose-400" />}
              </div>
            </div>

            {/* Remote tile — only when in-call */}
            {inCall && (
              <div className="relative bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center min-h-[160px]">
                <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg glass-dark text-white text-[11px] font-semibold">
                  {partnerName}
                </div>
              </div>
            )}
          </div>

          {/* Waiting / matched overlay */}
          <AnimatePresence>
            {(phase === 'connecting' || phase === 'waiting' || phase === 'matched') && (
              <motion.div
                key={phase}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-3 flex flex-col items-center justify-center gap-5 rounded-2xl"
                style={{ background: 'rgba(15,10,40,0.70)', backdropFilter: 'blur(8px)' }}
              >
                {/* Spinner */}
                <div className="relative">
                  <div className={`w-14 h-14 rounded-full border-4 animate-spin ${
                    phase === 'matched'
                      ? 'border-emerald-100/30 border-t-emerald-400'
                      : 'border-indigo-100/30 border-t-indigo-400'
                  }`} />
                  {phase === 'matched' && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-4 border-emerald-400/20"
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                    />
                  )}
                </div>

                <div className="text-center space-y-1.5">
                  <motion.p
                    className="text-white font-semibold text-base"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {phase === 'connecting' && 'Setting up…'}
                    {phase === 'waiting'    && 'Looking for someone…'}
                    {phase === 'matched'    && `Matched with ${partnerName}!`}
                  </motion.p>
                  <p className="text-white/40 text-sm">
                    {phase === 'connecting' && 'Getting your camera ready'}
                    {phase === 'waiting'    && "You'll be connected as soon as someone is available"}
                    {phase === 'matched'    && 'Establishing connection…'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Controls */}
      <div className="flex-shrink-0 pb-safe">
        <div
          className="flex items-center justify-center gap-6 px-6 py-5"
          style={{ background: 'rgba(15,10,40,0.70)', backdropFilter: 'blur(16px)' }}
        >
          <button onClick={toggleMute} className="flex flex-col items-center gap-1.5 cursor-pointer" aria-label={isMuted ? 'Unmute' : 'Mute'}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isMuted ? 'bg-white/20 border border-white/20' : 'glass-dark'}`}>
              {isMuted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
            </div>
            <span className="text-[10px] text-white/70 font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button onClick={toggleCam} className="flex flex-col items-center gap-1.5 cursor-pointer" aria-label={isCamOff ? 'Cam On' : 'Cam Off'}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isCamOff ? 'bg-white/20 border border-white/20' : 'glass-dark'}`}>
              {isCamOff ? <VideoOff size={22} className="text-white" /> : <Video size={22} className="text-white" />}
            </div>
            <span className="text-[10px] text-white/70 font-medium">{isCamOff ? 'Cam On' : 'Cam Off'}</span>
          </button>

          <button onClick={handleLeave} className="flex flex-col items-center gap-1.5 cursor-pointer" aria-label="Leave">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-xl">
              <PhoneOff size={22} className="text-white" />
            </div>
            <span className="text-[10px] text-white/70 font-medium">Leave</span>
          </button>
        </div>
      </div>
    </div>
  );
};
