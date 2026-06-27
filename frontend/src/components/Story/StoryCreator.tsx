import React, { useRef, useState } from 'react';
import { Camera, Film, X, Globe, Lock, MapPin, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { overlayVariants, sheetVariants } from '@/utils/animations';
import { storyService } from '@/services/storyService';

interface Props {
  userLocation?:    { latitude: number; longitude: number } | null;
  onCreated:        () => void;
  onClose:          () => void;
  initialMediaUrl?:  string;
  initialMediaType?: 'image' | 'video';
}

type Vis = 'public' | 'friends' | 'nearby';

const VIS_OPTS: { value: Vis; label: string; Icon: React.ElementType; desc: string; gradient: string }[] = [
  { value: 'public',  label: 'Public',  Icon: Globe,  desc: 'Anyone can see', gradient: 'linear-gradient(135deg,#10b981,#059669)' },
  { value: 'friends', label: 'Friends', Icon: Lock,   desc: 'Followers only',  gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)' },
  { value: 'nearby',  label: 'Nearby',  Icon: MapPin, desc: 'People near you', gradient: 'linear-gradient(135deg,#f97316,#ef4444)' },
];

export const StoryCreator: React.FC<Props> = ({
  userLocation, onCreated, onClose, initialMediaUrl, initialMediaType,
}) => {
  const [open,          setOpen]         = useState(true);
  const [file,          setFile]         = useState<File | null>(null);
  const [preview,       setPreview]      = useState<string>(initialMediaUrl || '');
  const [previewType,   setPreviewType]  = useState<'image' | 'video'>(initialMediaType || 'image');
  const [text,          setText]         = useState('');
  const [visibility,    setVisibility]   = useState<Vis>('public');
  const [nearbyRadius,  setNearbyRadius] = useState(5);
  const [uploading,     setUploading]    = useState(false);
  const [progress,      setProgress]     = useState(0);
  const [error,         setError]        = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  const handleClose = () => setOpen(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      setError('Only images and videos are allowed');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setPreviewType(f.type.startsWith('video/') ? 'video' : 'image');
    setError('');
  };

  const clearMedia = () => {
    if (preview && !initialMediaUrl) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview('');
  };

  const handlePost = async () => {
    let mediaFile = file;
    if (!mediaFile && preview) {
      try {
        const resp = await fetch(preview);
        const blob = await resp.blob();
        const ext  = previewType === 'video' ? '.mp4' : '.jpg';
        mediaFile  = new File([blob], `shared${ext}`, {
          type: blob.type || (previewType === 'video' ? 'video/mp4' : 'image/jpeg'),
        });
      } catch {
        setError('Failed to load media from source');
        return;
      }
    }
    if (!mediaFile) return;
    setUploading(true);
    setError('');
    try {
      await storyService.createStory({
        media:        mediaFile,
        text:         text.trim(),
        visibility,
        nearbyRadius: visibility === 'nearby' ? nearbyRadius : undefined,
        latitude:     userLocation?.latitude,
        longitude:    userLocation?.longitude,
      }, setProgress);
      if (preview && !initialMediaUrl) URL.revokeObjectURL(preview);
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to post story');
    } finally {
      setUploading(false);
    }
  };

  const canPost = (!!file || !!preview) && !uploading;

  return (
    <AnimatePresence onExitComplete={onClose}>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-[#0f0a28]/45" />

          <motion.div
            className="absolute bottom-0 left-0 right-0 glass-strong rounded-t-3xl max-h-[92dvh] flex flex-col overflow-hidden"
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-slate-300/70 mx-auto mt-3 mb-1 flex-shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/40 flex-shrink-0">
              <button
                onClick={handleClose}
                className="btn-icon w-8 h-8 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100/60"
                aria-label="Close"
              >
                <X size={15} />
              </button>
              <h3 className="text-sm font-bold text-slate-800">New Story</h3>
              <motion.button
                onClick={handlePost}
                disabled={!canPost}
                className="btn-primary text-xs px-4 h-8 disabled:opacity-50 disabled:cursor-not-allowed"
                whileTap={{ scale: canPost ? 0.96 : 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 400 }}
              >
                {uploading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size={12} className="animate-spin" />
                    {progress}%
                  </span>
                ) : 'Share'}
              </motion.button>
            </div>

            {/* Upload progress bar */}
            <AnimatePresence>
              {uploading && (
                <motion.div
                  className="h-[3px] flex-shrink-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg,#6366f1,#ec4899,#f97316)',
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-4 pb-safe flex flex-col gap-4" style={{ scrollbarWidth: 'none' }}>

              {/* ── Media picker / preview ── */}
              {!preview ? (
                <motion.button
                  className="w-full rounded-2xl border-2 border-dashed border-indigo-200/70 hover:border-indigo-400 transition-colors flex flex-col items-center justify-center gap-3 py-12 bg-indigo-50/30 hover:bg-indigo-50/50"
                  onClick={() => fileRef.current?.click()}
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                >
                  <div className="flex gap-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                    >
                      <Camera size={20} className="text-white" />
                    </div>
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,#ec4899,#f97316)' }}
                    >
                      <Film size={20} className="text-white" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">Add photo or video</p>
                    <p className="text-xs text-slate-400 mt-0.5">Tap to select from your gallery</p>
                  </div>
                </motion.button>
              ) : (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[40dvh]">
                  {previewType === 'image' ? (
                    <img src={preview} alt="preview" className="w-full h-full object-contain" />
                  ) : (
                    <video src={preview} className="w-full h-full object-contain" controls muted playsInline />
                  )}
                  <button
                    className="absolute top-2 right-2 btn-icon w-7 h-7 rounded-lg text-white bg-black/50 hover:bg-black/70 transition-colors"
                    onClick={clearMedia}
                    aria-label="Remove media"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFile}
              />

              {/* ── Caption ── */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Caption
                </label>
                <textarea
                  className="input-glass w-full rounded-xl resize-none text-sm text-slate-700 placeholder:text-slate-400"
                  placeholder="Add a caption…"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  maxLength={200}
                  rows={2}
                  style={{ padding: '10px 14px' }}
                />
                <p className="text-[10px] text-slate-400 mt-1 text-right">{text.length}/200</p>
              </div>

              {/* ── Visibility ── */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Who can see this
                </label>
                <div className="flex flex-col gap-2">
                  {VIS_OPTS.map(opt => {
                    const active = visibility === opt.value;
                    const Icon   = opt.Icon;
                    return (
                      <motion.button
                        key={opt.value}
                        onClick={() => setVisibility(opt.value)}
                        className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${active ? '' : 'glass-hover'}`}
                        style={active ? { background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.12))', border: '1.5px solid rgba(99,102,241,0.25)' } : {}}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                      >
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: active ? opt.gradient : 'rgba(148,163,184,0.15)' }}
                        >
                          <Icon size={15} className={active ? 'text-white' : 'text-slate-400'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {opt.label}
                          </p>
                          <p className="text-xs text-slate-400">{opt.desc}</p>
                        </div>
                        {active && (
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                          >
                            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                              <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Radius slider */}
                <AnimatePresence>
                  {visibility === 'nearby' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 glass rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-slate-600">Visible radius</label>
                          <span className="text-xs font-bold text-indigo-600">{nearbyRadius} km</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={50}
                          step={1}
                          value={nearbyRadius}
                          onChange={e => setNearbyRadius(Number(e.target.value))}
                          className="fx-slider w-full"
                        />
                        <div className="flex justify-between mt-1">
                          <span className="text-[10px] text-slate-400">1 km</span>
                          <span className="text-[10px] text-slate-400">50 km</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    className="text-sm text-rose-500 text-center glass rounded-xl px-4 py-3"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
