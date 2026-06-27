import React, { useState } from 'react';
import { X, Video, MapPin, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import videoRoomService, { VideoRoom } from '@/services/videoRoomService';
import { overlayVariants, sheetVariants } from '@/utils/animations';

interface Props {
  userLocation: { latitude: number; longitude: number } | null;
  displayName:  string;
  onClose:      () => void;
  onStarted:    (room: VideoRoom) => void;
}

export const StartRandomCallModal: React.FC<Props> = ({ userLocation, displayName, onClose, onStarted }) => {
  const [title,   setTitle]   = useState('');
  const [radius,  setRadius]  = useState(10);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleStart = async () => {
    if (!userLocation) { setError('Location permission required'); return; }
    setLoading(true); setError('');
    try {
      const room = await videoRoomService.create({
        latitude:    userLocation.latitude,
        longitude:   userLocation.longitude,
        radius,
        title:       title.trim() || 'Random Video Chat',
        creatorName: displayName,
      });
      onStarted(room);
    } catch (err: any) {
      setError(err?.message || 'Failed to start video call. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4"
        style={{ background: 'rgba(15,10,40,0.50)', backdropFilter: 'blur(6px)' }}
        variants={overlayVariants} initial="hidden" animate="visible" exit="exit"
        onClick={onClose}
      >
        <motion.div
          className="glass-strong rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm flex flex-col overflow-hidden"
          variants={sheetVariants} initial="hidden" animate="visible" exit="exit"
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-300/70" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                <Video size={15} className="text-white" />
              </div>
              <span className="text-sm font-bold text-slate-800">Start Random Video Call</span>
            </div>
            <button className="btn-icon text-slate-400" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Title <span className="font-normal text-slate-400 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Chat with neighbors"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={60}
                className="input-glass w-full"
              />
            </div>

            {/* Radius */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <MapPin size={11} className="text-indigo-400" /> Visible within
                </label>
                <span className="px-2 py-0.5 rounded-lg text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                  {radius} km
                </span>
              </div>
              <input
                type="range"
                className="fx-slider w-full"
                min={1} max={50} step={1}
                value={radius}
                onChange={e => setRadius(Number(e.target.value))}
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>1 km</span><span>50 km</span>
              </div>
            </div>

            {/* Warnings / errors */}
            <AnimatePresence>
              {!userLocation && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200/60"
                >
                  <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700">Location permission required for video calls</p>
                </motion.div>
              )}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200/60"
                >
                  <AlertCircle size={14} className="text-rose-500 flex-shrink-0" />
                  <p className="text-xs text-rose-600">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pb-safe pt-0">
            <button
              className="btn-primary w-full gap-2"
              onClick={handleStart}
              disabled={loading || !userLocation}
            >
              {loading
                ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                : <><Video size={15} /> Start Call</>
              }
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
