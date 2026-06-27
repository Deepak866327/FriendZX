import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { RC_WS_PATH } from '@/utils/constants';
import { storage } from '@/utils/storage';
import { VideoRoom } from '@/services/videoRoomService';
import videoRoomService from '@/services/videoRoomService';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface PeerState {
  peerId:   string;
  peerName: string;
  stream:   MediaStream | null;
  pc:       RTCPeerConnection;
}

interface Props {
  room:          VideoRoom;
  currentUserId: string;
  displayName:   string;
  onClose:       () => void;
}

const RemoteTile: React.FC<{ peer: PeerState }> = ({ peer }) => {
  const ref = useCallback((node: HTMLVideoElement | null) => {
    if (node && peer.stream) node.srcObject = peer.stream;
  }, [peer.stream]);

  return (
    <div className="relative bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center min-h-[160px]">
      {peer.stream ? (
        <video ref={ref} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold">
            {peer.peerName.charAt(0).toUpperCase()}
          </div>
          <motion.p className="text-white/50 text-xs" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.8, repeat: Infinity }}>
            Connecting…
          </motion.p>
        </div>
      )}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg glass-dark text-white text-[11px] font-semibold">
        {peer.peerName}
      </div>
    </div>
  );
};

export const VideoRoomModal: React.FC<Props> = ({ room, currentUserId, displayName, onClose }) => {
  const socketRef      = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef         = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCands   = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const [peers,       setPeers]       = useState<Map<string, PeerState>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted,     setIsMuted]     = useState(false);
  const [isCamOff,    setIsCamOff]    = useState(false);
  const [error,       setError]       = useState('');

  const roomId = room.id;

  const localVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && localStream) node.srcObject = localStream;
  }, [localStream]);

  const removePeer = useCallback((peerId: string) => {
    pcsRef.current.get(peerId)?.close();
    pcsRef.current.delete(peerId);
    setPeers(prev => { const n = new Map(prev); n.delete(peerId); return n; });
  }, []);

  const createPC = useCallback((peerId: string, peerName: string): RTCPeerConnection => {
    pcsRef.current.get(peerId)?.close();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate)
        socketRef.current?.emit('room:ice', { roomId, toUserId: peerId, candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const [stream] = e.streams;
      setPeers(prev => {
        const n = new Map(prev);
        n.set(peerId, { ...(n.get(peerId) || { peerId, peerName, stream: null, pc }), stream });
        return n;
      });
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) removePeer(peerId);
    };
    pcsRef.current.set(peerId, pc);
    setPeers(prev => {
      const n = new Map(prev);
      if (!n.has(peerId)) n.set(peerId, { peerId, peerName, stream: null, pc });
      return n;
    });
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    return pc;
  }, [roomId, removePeer]);

  const drainCands = useCallback(async (pc: RTCPeerConnection, peerId: string) => {
    const q = pendingCands.current.get(peerId) || [];
    pendingCands.current.delete(peerId);
    for (const c of q) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
  }, []);

  const sendOffer = useCallback(async (peerId: string, peerName: string) => {
    const pc = createPC(peerId, peerName);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('room:offer', { roomId, toUserId: peerId, sdp: offer });
    } catch { removePeer(peerId); }
  }, [createPC, roomId, removePeer]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: true,
        });
      } catch { setError('Camera/microphone access denied. Check browser permissions.'); return; }
      if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

      localStreamRef.current = stream;
      setLocalStream(stream);
      try { await videoRoomService.join(roomId, displayName); } catch {}

      const userId = storage.getUser()?.id;
      const socket = io({ path: RC_WS_PATH, query: { userId }, transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('room:current-peers', async (data: { peers: string[] }) => {
        for (const peerId of data.peers) {
          if (peerId !== currentUserId) {
            const peerName = room.participantNames[peerId] || peerId.slice(0, 8);
            await sendOffer(peerId, peerName);
          }
        }
      });
      socket.on('room:peer-joined', () => {});
      socket.on('room:peer-left', (data: { peerId: string }) => removePeer(data.peerId));
      socket.on('room:offer', async (data: { roomId: string; fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
        if (data.roomId !== roomId) return;
        const peerName = room.participantNames[data.fromUserId] || data.fromUserId.slice(0, 8);
        const pc = createPC(data.fromUserId, peerName);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await drainCands(pc, data.fromUserId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('room:answer', { roomId, toUserId: data.fromUserId, sdp: answer });
        } catch { removePeer(data.fromUserId); }
      });
      socket.on('room:answer', async (data: { roomId: string; fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
        if (data.roomId !== roomId) return;
        const pc = pcsRef.current.get(data.fromUserId);
        if (!pc) return;
        try { await pc.setRemoteDescription(new RTCSessionDescription(data.sdp)); await drainCands(pc, data.fromUserId); } catch {}
      });
      socket.on('room:ice', async (data: { roomId: string; fromUserId: string; candidate: RTCIceCandidateInit }) => {
        if (data.roomId !== roomId) return;
        const pc = pcsRef.current.get(data.fromUserId);
        if (!pc || !pc.remoteDescription) {
          const q = pendingCands.current.get(data.fromUserId) || [];
          q.push(data.candidate);
          pendingCands.current.set(data.fromUserId, q);
          return;
        }
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
      });

      socket.emit('room:join', { roomId, displayName });
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLeave = useCallback(async () => {
    socketRef.current?.emit('room:leave', { roomId });
    socketRef.current?.disconnect();
    pcsRef.current.forEach(pc => pc.close());
    pcsRef.current.clear();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    try { await videoRoomService.leave(roomId); } catch {}
    onClose();
  }, [roomId, onClose]);

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };
  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCamOff(c => !c);
  };

  const peerList = Array.from(peers.values());
  const totalCount = peerList.length + 1;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-safe py-3"
        style={{ background: 'rgba(15,10,40,0.80)', backdropFilter: 'blur(16px)' }}>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center flex-shrink-0">
          <Video size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{room.title}</p>
          <p className="text-[11px] text-white/50 flex items-center gap-1">
            <Users size={9} /> {totalCount} {totalCount === 1 ? 'person' : 'people'}
            {room.radius && <><span className="mx-1 opacity-40">·</span><MapPin size={9} /> within {room.radius} km</>}
          </p>
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
            <button onClick={handleLeave} className="text-xs text-white font-semibold px-3 py-1.5 rounded-xl bg-rose-500/30 hover:bg-rose-500/50 transition-colors">
              Leave
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video grid */}
      <div className="flex-1 overflow-hidden p-3">
        {!error && (
          <div className={`h-full grid gap-3 ${totalCount === 1 ? 'grid-cols-1' : totalCount <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
            {/* Local tile */}
            <div className="relative bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center min-h-[160px]">
              {localStream ? (
                <video ref={localVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full border-4 border-indigo-100/40 border-t-indigo-400 animate-spin" />
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-lg glass-dark">
                <span className="text-white text-[11px] font-semibold">You</span>
                {isMuted && <MicOff size={9} className="text-rose-400" />}
                {isCamOff && <VideoOff size={9} className="text-rose-400" />}
              </div>
            </div>

            {/* Remote tiles */}
            {peerList.map(p => <RemoteTile key={p.peerId} peer={p} />)}

            {/* Waiting state */}
            {peerList.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 text-center p-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100/10 to-violet-100/10 flex items-center justify-center">
                  <Users size={26} className="text-white/30" />
                </div>
                <div>
                  <p className="text-white/60 text-sm font-medium">Waiting for people to join…</p>
                  <p className="text-white/30 text-xs mt-1">Visible within {room.radius} km</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 pb-safe">
        <div className="flex items-center justify-center gap-6 px-6 py-5"
          style={{ background: 'rgba(15,10,40,0.70)', backdropFilter: 'blur(16px)' }}>
          <button
            className={`flex flex-col items-center gap-1.5 cursor-pointer`}
            onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isMuted ? 'bg-white/20 border border-white/20' : 'glass-dark'}`}>
              {isMuted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
            </div>
            <span className="text-[10px] text-white/70 font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            className="flex flex-col items-center gap-1.5 cursor-pointer"
            onClick={toggleCam} aria-label={isCamOff ? 'Cam On' : 'Cam Off'}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isCamOff ? 'bg-white/20 border border-white/20' : 'glass-dark'}`}>
              {isCamOff ? <VideoOff size={22} className="text-white" /> : <Video size={22} className="text-white" />}
            </div>
            <span className="text-[10px] text-white/70 font-medium">{isCamOff ? 'Cam On' : 'Cam Off'}</span>
          </button>

          <button
            className="flex flex-col items-center gap-1.5 cursor-pointer"
            onClick={handleLeave} aria-label="Leave"
          >
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
