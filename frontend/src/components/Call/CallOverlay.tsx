import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallContext } from '@/context/CallContext';

const PulseRing: React.FC<{ children: React.ReactNode; gradient: string }> = ({ children, gradient }) => (
  <div className="relative flex-shrink-0">
    <motion.div
      className={`absolute inset-0 rounded-full bg-gradient-to-br ${gradient}`}
      animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    />
    {children}
  </div>
);

const CtrlBtn: React.FC<{
  icon:    React.ReactNode;
  label:   string;
  active?: boolean;
  variant?: 'default' | 'end';
  onClick: () => void;
}> = ({ icon, label, active, variant = 'default', onClick }) => {
  const base = 'flex flex-col items-center gap-1.5 cursor-pointer';
  const ring =
    variant === 'end'
      ? 'w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-xl'
      : active
        ? 'w-14 h-14 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/20'
        : 'w-14 h-14 rounded-full glass-dark flex items-center justify-center';
  return (
    <button className={base} onClick={onClick} aria-label={label}>
      <div className={ring}>{icon}</div>
      <span className="text-[10px] text-white/80 font-medium">{label}</span>
    </button>
  );
};

export const CallOverlay: React.FC = () => {
  const { call, acceptCall, declineCall, endCall } = useCallContext();
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [isMuted,     setIsMuted]     = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && call?.localStream)
      localVideoRef.current.srcObject = call.localStream;
  }, [call?.localStream]);

  useEffect(() => {
    if (!call?.remoteStream) return;
    if (call.callType === 'video' && remoteVideoRef.current)
      remoteVideoRef.current.srcObject = call.remoteStream;
    else if (call.callType === 'audio' && remoteAudioRef.current)
      remoteAudioRef.current.srcObject = call.remoteStream;
  }, [call?.remoteStream, call?.callType]);

  const toggleMute = () => {
    call?.localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };

  const toggleCamera = () => {
    call?.localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOff(c => !c);
  };

  const initial = (name: string) => name.charAt(0).toUpperCase();

  if (!call) return null;

  const AvatarCircle: React.FC<{ size?: 'md' | 'lg'; name: string }> = ({ size = 'md', name }) => {
    const dim = size === 'lg' ? 'w-24 h-24 text-4xl' : 'w-16 h-16 text-2xl';
    return (
      <div className={`${dim} rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold flex-shrink-0`}>
        {initial(name)}
      </div>
    );
  };

  /* ── Requesting (outgoing to an offline user) ─────────────────── */
  if (call.status === 'requesting') return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ background: 'rgba(8,5,30,0.92)', backdropFilter: 'blur(16px)' }}>
      <motion.div
        className="glass-strong rounded-3xl p-8 flex flex-col items-center gap-5 w-full max-w-xs text-center"
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
      >
        <AvatarCircle name={call.peerName} size="lg" />
        <div>
          <p className="text-lg font-bold text-white">{call.peerName}</p>
          <p className="text-sm text-white/50 mt-1">Sending call request…</p>
        </div>
        <button
          onClick={declineCall}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-500/20 border border-rose-400/30 text-rose-300 text-sm font-semibold hover:bg-rose-500/30 transition-colors"
        >
          <PhoneOff size={15} /> Cancel
        </button>
      </motion.div>
    </div>
  );

  /* ── Ringing outgoing ─────────────────────────────────────────── */
  if (call.status === 'ringing-outgoing') return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between py-16 px-6"
      style={{ background: 'rgba(8,5,30,0.95)', backdropFilter: 'blur(16px)' }}>
      {/* BG local preview (blurred) */}
      {call.callType === 'video' && call.localStream && (
        <video
          ref={localVideoRef} autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover opacity-20"
          style={{ filter: 'blur(20px)' }}
        />
      )}
      <div className="relative z-10 flex flex-col items-center gap-6 mt-8">
        <AvatarCircle name={call.peerName} size="lg" />
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{call.peerName}</p>
          <motion.p
            className="text-sm text-white/50 mt-1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            {call.callType === 'video' ? 'Video' : 'Audio'} calling…
          </motion.p>
        </div>
      </div>
      <div className="relative z-10">
        <CtrlBtn icon={<PhoneOff size={22} className="text-white" />} label="Cancel" variant="end" onClick={declineCall} />
      </div>
    </div>
  );

  /* ── Incoming ring ────────────────────────────────────────────── */
  if (call.status === 'ringing-incoming') return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ background: 'rgba(8,5,30,0.92)', backdropFilter: 'blur(16px)' }}>
      <motion.div
        className="glass-strong rounded-3xl p-8 flex flex-col items-center gap-6 w-full max-w-xs text-center"
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
      >
        <PulseRing gradient="from-emerald-500 to-teal-500">
          <AvatarCircle name={call.peerName} size="lg" />
        </PulseRing>

        <div>
          <p className="text-lg font-bold text-white">{call.peerName}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1 text-white/50 text-sm">
            {call.callType === 'video' ? <Video size={13} /> : <Phone size={13} />}
            <span>Incoming {call.callType} call</span>
          </div>
        </div>

        <div className="flex gap-5">
          <CtrlBtn
            icon={<PhoneOff size={22} className="text-white" />}
            label="Decline"
            variant="end"
            onClick={declineCall}
          />
          <button
            className="flex flex-col items-center gap-1.5"
            onClick={acceptCall}
            aria-label="Accept"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-xl">
              {call.callType === 'video' ? <Video size={22} className="text-white" /> : <Phone size={22} className="text-white" />}
            </div>
            <span className="text-[10px] text-white/80 font-medium">Accept</span>
          </button>
        </div>
      </motion.div>
    </div>
  );

  /* ── Connecting / Active ──────────────────────────────────────── */
  if (call.status === 'connecting' || call.status === 'active') {
    const isVideo = call.callType === 'video';
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
        {/* Main content */}
        <div className="flex-1 relative overflow-hidden">
          {isVideo ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
              {/* PiP local preview */}
              <video
                ref={localVideoRef} autoPlay playsInline muted
                className="absolute top-4 right-4 w-28 h-36 rounded-2xl object-cover border-2 border-white/20 shadow-xl"
              />
            </>
          ) : (
            <>
              <audio ref={remoteAudioRef} autoPlay />
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-5xl">
                  {initial(call.peerName)}
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{call.peerName}</p>
                  <motion.p
                    className="text-sm text-white/50 mt-1"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  >
                    {call.status === 'connecting' ? 'Connecting…' : 'Connected'}
                  </motion.p>
                </div>
              </div>
            </>
          )}

          {/* Status badge */}
          <AnimatePresence>
            {call.status === 'connecting' && (
              <motion.div
                className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full glass-dark text-white/80 text-xs font-semibold"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              >
                Connecting…
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="flex-shrink-0 pb-safe">
          <div className="flex items-center justify-center gap-6 px-6 py-6">
            <CtrlBtn
              icon={isMuted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
              label={isMuted ? 'Unmute' : 'Mute'}
              active={isMuted}
              onClick={toggleMute}
            />
            {isVideo && (
              <CtrlBtn
                icon={isCameraOff ? <VideoOff size={22} className="text-white" /> : <Video size={22} className="text-white" />}
                label={isCameraOff ? 'Cam On' : 'Cam Off'}
                active={isCameraOff}
                onClick={toggleCamera}
              />
            )}
            <CtrlBtn
              icon={<PhoneOff size={22} className="text-white" />}
              label="End"
              variant="end"
              onClick={endCall}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
};
