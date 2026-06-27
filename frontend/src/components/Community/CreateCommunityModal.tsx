import React, { useState, useRef } from 'react';
import { X, Globe, Lock, MapPin, ImagePlus, Users, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import communityService, { CreateCommunityPayload, Community } from '@/services/communityService';
import { overlayVariants, sheetVariants } from '@/utils/animations';

interface Props {
  onClose:       () => void;
  onCreated:     (c: Community) => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

export const CreateCommunityModal: React.FC<Props> = ({ onClose, onCreated, userLocation }) => {
  const [name,         setName]         = useState('');
  const [description,  setDescription]  = useState('');
  const [mode,         setMode]         = useState<'public' | 'private'>('public');
  const [visibility,   setVisibility]   = useState<'public' | 'nearby'>('public');
  const [nearbyRadius, setNearbyRadius] = useState(10);
  const [coverFile,    setCoverFile]    = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Community name is required'); return; }
    if (mode === 'public' && visibility === 'nearby' && !userLocation) {
      setError('Location permission required for nearby visibility'); return;
    }
    const payload: CreateCommunityPayload = {
      name:        name.trim(),
      description: description.trim(),
      mode,
      coverImage:  coverFile || undefined,
    };
    if (mode === 'public') {
      payload.visibility = visibility;
      if (visibility === 'nearby' && userLocation) {
        payload.nearbyRadius = nearbyRadius;
        payload.latitude     = userLocation.latitude;
        payload.longitude    = userLocation.longitude;
      }
    }
    setLoading(true); setError('');
    try {
      const community = await communityService.create(payload);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      onCreated(community); onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create community');
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
          className="glass-strong rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md flex flex-col overflow-hidden"
          style={{ maxHeight: '92dvh' }}
          variants={sheetVariants} initial="hidden" animate="visible" exit="exit"
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-300/70" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/30 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <Sparkles size={15} className="text-white" />
              </div>
              <span className="text-sm font-bold text-slate-800">Create Community</span>
            </div>
            <button className="btn-icon text-slate-400" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Cover image */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cover Image</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative w-full h-28 rounded-2xl overflow-hidden border-2 border-dashed border-indigo-200/70 bg-indigo-50/50 flex flex-col items-center justify-center gap-2 text-indigo-400 hover:bg-indigo-50 transition-colors"
                >
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImagePlus size={24} />
                      <span className="text-xs font-medium">Add cover photo</span>
                    </>
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Give your community a name…"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={80}
                  className="input-glass w-full"
                />
                <p className="text-right text-[10px] text-slate-400 mt-1">{name.length}/80</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  placeholder="What is this community about?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="input-glass w-full resize-none"
                />
              </div>

              {/* Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Community Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'public',  icon: Globe, label: 'Public',  desc: 'Anyone can find & join' },
                    { value: 'private', icon: Lock,  label: 'Private', desc: 'Admin adds members only' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className={`flex flex-col items-center gap-1.5 p-3.5 rounded-2xl border-2 transition-all ${
                        mode === opt.value
                          ? 'border-indigo-400/60 text-white'
                          : 'glass border-transparent text-slate-600 hover:bg-white/60'
                      }`}
                      style={mode === opt.value ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' } : undefined}
                    >
                      <opt.icon size={18} />
                      <span className="text-xs font-bold">{opt.label}</span>
                      <span className={`text-[10px] text-center leading-tight ${mode === opt.value ? 'text-white/70' : 'text-slate-400'}`}>
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility — public mode only */}
              <AnimatePresence>
                {mode === 'public' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Visibility
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: 'public', icon: Globe,  label: 'Everyone' },
                          { value: 'nearby', icon: MapPin, label: 'Nearby' },
                        ] as const).map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setVisibility(opt.value)}
                            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border-2 text-sm font-semibold transition-all ${
                              visibility === opt.value
                                ? 'border-indigo-400/60 text-white'
                                : 'glass border-transparent text-slate-600 hover:bg-white/60'
                            }`}
                            style={visibility === opt.value ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' } : undefined}
                          >
                            <opt.icon size={14} />
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Nearby radius */}
                      <AnimatePresence>
                        {visibility === 'nearby' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="glass rounded-2xl p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-600">Visible within</span>
                                <span className="px-2 py-0.5 rounded-lg text-xs font-bold text-white"
                                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                                  {nearbyRadius} km
                                </span>
                              </div>
                              <input
                                type="range"
                                className="fx-slider w-full"
                                min={0.5} max={100} step={0.5}
                                value={nearbyRadius}
                                onChange={e => setNearbyRadius(Number(e.target.value))}
                              />
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span>0.5 km</span><span>100 km</span>
                              </div>
                              {!userLocation && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200/60">
                                  <AlertCircle size={13} className="text-amber-500 flex-shrink-0" />
                                  <p className="text-xs text-amber-700">Location permission required</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              <AnimatePresence>
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
            <div className="px-5 py-4 border-t border-white/30 flex-shrink-0 pb-safe">
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="btn-primary w-full gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <><Users size={15} /> Create Community</>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
