import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CallState, CallType, IncomingCallRequest, PublicProfile } from '@/types/api';
import { useSocket } from '@/context/SocketContext';
import { userService } from '@/services/userService';
import { storage } from '@/utils/storage';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function makeCallId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface CallContextType {
  call: CallState | null;
  incomingRequest: IncomingCallRequest | null;
  initiateCall: (profile: PublicProfile, callType: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  approveRequest: () => void;
  denyRequest: () => void;
  endCall: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { on, off, emit } = useSocket();
  const [call, setCall] = useState<CallState | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<IncomingCallRequest | null>(null);

  // Refs for async handlers — always read current values without stale closures
  const callRef = useRef<CallState | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<{ fromUserId: string; callId: string; sdp: RTCSessionDescriptionInit } | null>(null);

  useEffect(() => { callRef.current = call; }, [call]);

  const stopMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    stopMedia();
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    pendingCandidatesRef.current = [];
    pendingOfferRef.current = null;
    setCall(null);
  }, [stopMedia]);

  const getMedia = useCallback(async (callType: CallType): Promise<MediaStream> => {
    return navigator.mediaDevices.getUserMedia(
      callType === 'video'
        ? { audio: true, video: { width: { ideal: 640 }, height: { ideal: 480 } } }
        : { audio: true, video: false }
    );
  }, []);

  const drainCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const queue = pendingCandidatesRef.current.splice(0);
    for (const c of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
  }, []);

  const createPC = useCallback((peerId: string, callId: string): RTCPeerConnection => {
    if (pcRef.current) { pcRef.current.close(); }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate) emit('call:ice', { toUserId: peerId, callId, candidate: e.candidate.toJSON() });
    };

    pc.ontrack = (e) => {
      const [remoteStream] = e.streams;
      setCall(prev => prev ? { ...prev, remoteStream } : prev);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCall(prev => prev ? { ...prev, status: 'active' } : prev);
      } else if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        cleanup();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [emit, cleanup]);

  const myDisplayName = useCallback(() => {
    const u = storage.getUser();
    return u?.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : (u?.email || 'Unknown');
  }, []);

  // ── Initiate call ──────────────────────────────────────────────────────────
  const initiateCall = useCallback(async (profile: PublicProfile, callType: CallType) => {
    if (callRef.current) return;

    const callId = makeCallId();
    const peerName = profile.firstName
      ? `${profile.firstName} ${profile.lastName || ''}`.trim()
      : profile.userId.slice(0, 8);

    let isMutual = false;
    try { isMutual = (await userService.getRelationship(profile.userId)).isMutual; } catch {}

    if (isMutual) {
      let stream: MediaStream;
      try { stream = await getMedia(callType); } catch {
        alert('Could not access camera/microphone. Please check permissions.');
        return;
      }
      localStreamRef.current = stream;
      setCall({ callId, peerId: profile.userId, peerName, callType, status: 'ringing-outgoing', isOutgoing: true, localStream: stream });
      emit('call:ring', { toUserId: profile.userId, callType, callId, fromName: myDisplayName() });
    } else {
      setCall({ callId, peerId: profile.userId, peerName, callType, status: 'requesting', isOutgoing: true });
      emit('call:request', { toUserId: profile.userId, callType, callId, fromName: myDisplayName() });
    }
  }, [emit, getMedia, myDisplayName]);

  // ── Accept incoming ring ───────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    const c = callRef.current;
    if (!c || c.status !== 'ringing-incoming') return;

    let stream: MediaStream;
    try { stream = await getMedia(c.callType); } catch {
      alert('Could not access camera/microphone. Please check permissions.');
      return;
    }
    localStreamRef.current = stream;
    setCall(prev => prev ? { ...prev, status: 'connecting', localStream: stream } : prev);
    emit('call:accept', { toUserId: c.peerId, callId: c.callId });

    // Process buffered offer (arrived before media was ready)
    if (pendingOfferRef.current?.callId === c.callId) {
      const pending = pendingOfferRef.current;
      pendingOfferRef.current = null;
      const pc = createPC(pending.fromUserId, pending.callId);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(pending.sdp));
        await drainCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emit('call:answer', { toUserId: pending.fromUserId, callId: pending.callId, sdp: answer });
      } catch { cleanup(); }
    }
  }, [emit, getMedia, createPC, drainCandidates, cleanup]);

  // ── Decline / cancel ──────────────────────────────────────────────────────
  const declineCall = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    if (c.status === 'ringing-incoming') emit('call:decline', { toUserId: c.peerId, callId: c.callId });
    else emit('call:cancel', { toUserId: c.peerId, callId: c.callId });
    cleanup();
  }, [emit, cleanup]);

  // ── Approve / deny call request ────────────────────────────────────────────
  const approveRequest = useCallback(() => {
    const req = incomingRequest;
    if (!req) return;
    setIncomingRequest(null);
    emit('call:request:approve', { toUserId: req.fromUserId, callId: req.callId });
  }, [incomingRequest, emit]);

  const denyRequest = useCallback(() => {
    const req = incomingRequest;
    if (!req) return;
    setIncomingRequest(null);
    emit('call:request:deny', { toUserId: req.fromUserId, callId: req.callId });
  }, [incomingRequest, emit]);

  // ── End active call ────────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    const c = callRef.current;
    if (c) emit('call:end', { toUserId: c.peerId, callId: c.callId });
    cleanup();
  }, [emit, cleanup]);

  // ── Socket event handlers ──────────────────────────────────────────────────
  useEffect(() => {
    const onIncomingRequest = (data: IncomingCallRequest) => {
      setIncomingRequest(data);
    };

    const onRequestApproved = async (data: { callId: string }) => {
      const c = callRef.current;
      if (!c || c.callId !== data.callId) return;
      let stream: MediaStream;
      try { stream = await getMedia(c.callType); } catch {
        alert('Could not access camera/microphone.');
        cleanup();
        return;
      }
      localStreamRef.current = stream;
      setCall(prev => prev ? { ...prev, status: 'ringing-outgoing', localStream: stream } : prev);
      emit('call:ring', { toUserId: c.peerId, callType: c.callType, callId: c.callId, fromName: myDisplayName() });
    };

    const onRequestDenied = () => { cleanup(); };

    const onRinging = (data: { fromUserId: string; fromName: string; callType: CallType; callId: string }) => {
      if (callRef.current) return; // already in a call
      setCall({ callId: data.callId, peerId: data.fromUserId, peerName: data.fromName, callType: data.callType, status: 'ringing-incoming', isOutgoing: false });
    };

    const onAccepted = async (data: { callId: string }) => {
      const c = callRef.current;
      if (!c || c.callId !== data.callId) return;
      setCall(prev => prev ? { ...prev, status: 'connecting' } : prev);
      const pc = createPC(c.peerId, c.callId);
      localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emit('call:offer', { toUserId: c.peerId, callId: c.callId, sdp: offer });
      } catch { cleanup(); }
    };

    const onDeclined = () => { cleanup(); };
    const onCancelled = () => { cleanup(); };

    const onOffer = async (data: { fromUserId: string; callId: string; sdp: RTCSessionDescriptionInit }) => {
      const c = callRef.current;
      if (!c || c.callId !== data.callId) return;
      if (!localStreamRef.current) { pendingOfferRef.current = data; return; }
      const pc = createPC(data.fromUserId, data.callId);
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await drainCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emit('call:answer', { toUserId: data.fromUserId, callId: data.callId, sdp: answer });
      } catch { cleanup(); }
    };

    const onAnswer = async (data: { fromUserId: string; callId: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await drainCandidates(pc);
      } catch {}
    };

    const onIce = async (data: { fromUserId: string; callId: string; candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) { pendingCandidatesRef.current.push(data.candidate); return; }
      try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
    };

    const onEnded = () => { cleanup(); };

    on('call:incoming-request', onIncomingRequest);
    on('call:request:approved', onRequestApproved);
    on('call:request:denied', onRequestDenied);
    on('call:ringing', onRinging);
    on('call:accepted', onAccepted);
    on('call:declined', onDeclined);
    on('call:cancelled', onCancelled);
    on('call:offer', onOffer);
    on('call:answer', onAnswer);
    on('call:ice', onIce);
    on('call:ended', onEnded);

    return () => {
      off('call:incoming-request', onIncomingRequest);
      off('call:request:approved', onRequestApproved);
      off('call:request:denied', onRequestDenied);
      off('call:ringing', onRinging);
      off('call:accepted', onAccepted);
      off('call:declined', onDeclined);
      off('call:cancelled', onCancelled);
      off('call:offer', onOffer);
      off('call:answer', onAnswer);
      off('call:ice', onIce);
      off('call:ended', onEnded);
    };
  }, [on, off, emit, getMedia, createPC, drainCandidates, cleanup, myDisplayName]);

  return (
    <CallContext.Provider value={{ call, incomingRequest, initiateCall, acceptCall, declineCall, approveRequest, denyRequest, endCall }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCallContext = (): CallContextType => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCallContext must be used within CallProvider');
  return ctx;
};
