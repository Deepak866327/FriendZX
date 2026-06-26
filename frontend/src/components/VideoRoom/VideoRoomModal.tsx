import React, { useEffect, useRef, useState, useCallback } from 'react';
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

interface VideoRoomModalProps {
  room:          VideoRoom;
  currentUserId: string;
  displayName:   string;
  onClose:       () => void;
}

export const VideoRoomModal: React.FC<VideoRoomModalProps> = ({
  room, currentUserId, displayName, onClose,
}) => {
  const socketRef        = useRef<Socket | null>(null);
  const localStreamRef   = useRef<MediaStream | null>(null);
  const pcsRef           = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCands     = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const [peers,      setPeers]      = useState<Map<string, PeerState>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted,    setIsMuted]    = useState(false);
  const [isCamOff,   setIsCamOff]   = useState(false);
  const [error,      setError]      = useState('');

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
      } catch {
        setError('Camera/microphone access denied. Check browser permissions.');
        return;
      }
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

      socket.on('room:peer-joined', (_data: { peerId: string; peerName: string }) => {
        // They will send us an offer; nothing to do here
      });

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

  return (
    <div className="vroom-overlay">
      <div className="vroom-header">
        <span className="vroom-title">{room.title}</span>
        <span className="vroom-count">{peerList.length + 1} in call</span>
      </div>

      {error ? (
        <div className="vroom-error"><p>{error}</p><button className="btn btn-secondary" onClick={handleLeave}>Leave</button></div>
      ) : (
        <div className={`vroom-grid vroom-grid--${Math.min(peerList.length + 1, 4)}`}>
          <div className="vroom-tile vroom-tile--local">
            <video ref={localVideoRef} autoPlay playsInline muted className="vroom-video" />
            <div className="vroom-tile__label">You {isMuted && '🔇'}{isCamOff && ' 🚫'}</div>
          </div>
          {peerList.map(p => <RemoteTile key={p.peerId} peer={p} />)}
          {peerList.length === 0 && (
            <div className="vroom-waiting">
              <div className="vroom-waiting__icon">👥</div>
              <p>Waiting for nearby people to join…</p>
              <p className="vroom-waiting__sub">Visible within {room.radius} km</p>
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

const RemoteTile: React.FC<{ peer: PeerState }> = ({ peer }) => {
  const ref = useCallback((node: HTMLVideoElement | null) => {
    if (node && peer.stream) node.srcObject = peer.stream;
  }, [peer.stream]);

  return (
    <div className="vroom-tile">
      {peer.stream
        ? <video ref={ref} autoPlay playsInline className="vroom-video" />
        : (
          <div className="vroom-tile__placeholder">
            <div className="vroom-tile__avatar">{peer.peerName.charAt(0).toUpperCase()}</div>
            <div className="vroom-tile__connecting">Connecting…</div>
          </div>
        )
      }
      <div className="vroom-tile__label">{peer.peerName}</div>
    </div>
  );
};
