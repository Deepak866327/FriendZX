import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Globe, Lock, MapPin, X, ArrowLeft, ImagePlus, Plus, CheckCircle, AlertCircle, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { overlayVariants, sheetVariants, pageVariants } from '@/utils/animations';
import postService, { Post } from '@/services/postService';
import { uploadFile, MediaItem, UploadProgress } from '@/services/mediaService';

type Visibility = 'PUBLIC' | 'FRIENDS' | 'NEARBY';

const VIS_OPTS: { key: Visibility; label: string; Icon: React.FC<{ size?: number | string; className?: string }>; desc: string }[] = [
  { key: 'PUBLIC',  label: 'Public',  Icon: Globe,   desc: 'Anyone can see' },
  { key: 'FRIENDS', label: 'Friends', Icon: Lock,    desc: 'Followers only' },
  { key: 'NEARBY',  label: 'Nearby',  Icon: MapPin,  desc: 'People near you' },
];

interface UploadingFile {
  file:    File;
  preview: string;
  pct:     number;
  done:    boolean;
  error:   string;
  media:   MediaItem | null;
}

interface CreatePostModalProps {
  onClose:      () => void;
  onCreated:    (post: Post) => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({ onClose, onCreated, userLocation }) => {
  const [open, setOpen] = useState(true);
  const handleClose = () => setOpen(false);

  const [step,        setStep]       = useState<'pick' | 'compose'>('pick');
  const [files,       setFiles]      = useState<UploadingFile[]>([]);
  const [caption,     setCaption]    = useState('');
  const [visibility,  setVisibility] = useState<Visibility>('PUBLIC');
  const [radius,      setRadius]     = useState(10);
  const [location,    setLocation]   = useState(userLocation ?? null);
  const [submitting,  setSubmitting] = useState(false);
  const [error,       setError]      = useState('');
  const [dragging,    setDragging]   = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const inputRef   = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (visibility === 'NEARBY' && !location) {
      navigator.geolocation?.getCurrentPosition(
        p => setLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => {},
      );
    }
  }, [visibility]);

  useEffect(() => {
    if (step === 'compose') setTimeout(() => captionRef.current?.focus(), 80);
  }, [step]);

  const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

  const addFiles = useCallback(async (incoming: File[]) => {
    const rejected = incoming.filter(f => !ALLOWED.has(f.type.toLowerCase()));
    if (rejected.length) {
      setError(`Unsupported format: ${rejected.map(f => f.name.split('.').pop()?.toUpperCase()).join(', ')}. Use JPG, PNG or WebP.`);
    }
    const valid = incoming.filter(f => ALLOWED.has(f.type.toLowerCase()));
    const slots = 10 - files.length;
    const toAdd = valid.slice(0, slots);
    if (!toAdd.length) return;
    setError('');

    const startIdx = files.length;
    const newItems: UploadingFile[] = toAdd.map(f => ({
      file: f, preview: URL.createObjectURL(f),
      pct: 0, done: false, error: '', media: null,
    }));
    setFiles(prev => [...prev, ...newItems]);

    toAdd.forEach((file, i) => {
      const idx = startIdx + i;
      uploadFile(file, (prog: UploadProgress) => {
        setFiles(prev => prev.map((x, j) => j === idx ? { ...x, pct: prog.percent } : x));
      })
        .then(media => setFiles(prev => prev.map((x, j) => j === idx ? { ...x, media, done: true, pct: 100 } : x)))
        .catch(err => setFiles(prev => prev.map((x, j) => j === idx ? { ...x, error: err.message } : x)));
    });
  }, [files.length]);

  const removeFile = (idx: number) => {
    setFiles(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      const next = prev.filter((_, i) => i !== idx);
      setCarouselIdx(Math.min(carouselIdx, Math.max(0, next.length - 1)));
      return next;
    });
  };

  const uploading  = files.some(f => !f.done && !f.error);
  const anyError   = files.some(f => !!f.error);
  const readyMedia = files.filter(f => f.done && f.media).map(f => f.media!);
  const canContinue = files.length > 0 && !uploading && !anyError;

  const submit = async () => {
    if (!caption.trim() && !readyMedia.length) return setError('Add some text or at least one photo');
    setSubmitting(true); setError('');
    try {
      const post = await postService.createPost({
        caption:   caption.trim() || undefined,
        visibility,
        latitude:  visibility === 'NEARBY' ? location?.latitude  : undefined,
        longitude: visibility === 'NEARBY' ? location?.longitude : undefined,
        mediaIds:  readyMedia.map(m => m.id),
      });
      onCreated(post);
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false); }
  };

  const current = files[carouselIdx];

  return (
    <AnimatePresence onExitComplete={onClose}>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-[#0f0a28]/45" />

          <motion.div
            className="relative z-10 w-full max-w-lg glass-strong rounded-t-3xl flex flex-col overflow-hidden"
            style={{ maxHeight: '92dvh' }}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-slate-300/70 mx-auto mt-3 mb-0.5 flex-shrink-0" />

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/40 flex-shrink-0">
              {step === 'compose' ? (
                <button
                  onClick={() => setStep('pick')}
                  className="btn-icon w-8 h-8 rounded-xl text-slate-500 hover:text-slate-700"
                  aria-label="Back"
                >
                  <ArrowLeft size={16} />
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="btn-icon w-8 h-8 rounded-xl text-slate-500 hover:text-slate-700"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              )}

              <h3 className="text-sm font-bold text-slate-800">
                {step === 'pick' ? 'New Post' : 'Add details'}
              </h3>

              {step === 'compose' ? (
                <motion.button
                  onClick={submit}
                  disabled={submitting}
                  className="btn-primary text-xs px-4"
                  style={{ minHeight: 32 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                >
                  {submitting ? 'Sharing…' : 'Share'}
                </motion.button>
              ) : (
                <span className="w-[60px]" />
              )}
            </div>

            {/* ── Body ── */}
            <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'none' }}>
              <AnimatePresence mode="wait">

                {/* ══ STEP 1 — Pick ══ */}
                {step === 'pick' && (
                  <motion.div
                    key="pick"
                    className="p-4 flex flex-col gap-4"
                    variants={pageVariants} initial="hidden" animate="visible" exit="exit"
                  >
                    {files.length === 0 ? (
                      /* Drop zone */
                      <div
                        className={`rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-12 cursor-pointer transition-all duration-200 ${
                          dragging
                            ? 'border-indigo-400 bg-indigo-50/50'
                            : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                        }`}
                        onClick={() => inputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
                      >
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                        >
                          <ImagePlus size={26} className="text-white" />
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-slate-700 text-sm">Drag photos here</p>
                          <p className="text-xs text-slate-400 mt-1">JPG · PNG · WebP — max 20 MB · up to 10</p>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary text-sm px-5"
                          style={{ minHeight: 38 }}
                          onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                        >
                          <Camera size={14} /> Select from device
                        </button>
                      </div>
                    ) : (
                      /* Preview stage */
                      <div className="flex flex-col gap-3">
                        {/* Main image */}
                        <div className="relative rounded-2xl overflow-hidden bg-slate-100" style={{ aspectRatio: '1' }}>
                          {current && (
                            <>
                              <img src={current.preview} alt="" className="w-full h-full object-cover" />

                              {/* Upload progress */}
                              {!current.done && !current.error && (
                                <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center gap-2">
                                  <div className="w-48 h-1.5 bg-white/30 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-300"
                                      style={{ width: `${current.pct}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }}
                                    />
                                  </div>
                                  <span className="text-white text-xs font-medium">{current.pct}%</span>
                                </div>
                              )}
                              {current.done && (
                                <div className="absolute top-2 right-2">
                                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <CheckCircle size={16} className="text-white" />
                                  </div>
                                </div>
                              )}
                              {current.error && (
                                <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                                  <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-red-600 text-xs font-medium">
                                    <AlertCircle size={14} /> {current.error}
                                  </div>
                                </div>
                              )}

                              {/* Carousel arrows */}
                              {files.length > 1 && (
                                <>
                                  <button
                                    className="absolute left-2 top-1/2 -translate-y-1/2 glass w-8 h-8 rounded-full flex items-center justify-center text-slate-700 font-bold text-lg disabled:opacity-40"
                                    onClick={() => setCarouselIdx(i => Math.max(0, i - 1))}
                                    disabled={carouselIdx === 0}
                                  >‹</button>
                                  <button
                                    className="absolute right-2 top-1/2 -translate-y-1/2 glass w-8 h-8 rounded-full flex items-center justify-center text-slate-700 font-bold text-lg disabled:opacity-40"
                                    onClick={() => setCarouselIdx(i => Math.min(files.length - 1, i + 1))}
                                    disabled={carouselIdx === files.length - 1}
                                  >›</button>
                                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 glass text-xs font-semibold text-slate-700 px-2 py-0.5 rounded-full">
                                    {carouselIdx + 1} / {files.length}
                                  </span>
                                </>
                              )}
                            </>
                          )}
                        </div>

                        {/* Thumbnail strip */}
                        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                          {files.map((f, i) => (
                            <div
                              key={i}
                              className={`relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden cursor-pointer transition-all duration-150 ${
                                i === carouselIdx ? 'ring-2 ring-indigo-500 ring-offset-1' : 'opacity-70'
                              }`}
                              onClick={() => setCarouselIdx(i)}
                            >
                              <img src={f.preview} alt="" className="w-full h-full object-cover" />
                              {f.done && (
                                <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                  <CheckCircle size={10} className="text-white" />
                                </div>
                              )}
                              {!f.done && !f.error && (
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                  <span className="text-white text-[9px] font-bold">{f.pct}%</span>
                                </div>
                              )}
                              <button
                                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center text-white"
                                onClick={e => { e.stopPropagation(); removeFile(i); }}
                                aria-label="Remove"
                              >
                                <X size={9} />
                              </button>
                            </div>
                          ))}
                          {files.length < 10 && (
                            <button
                              className="w-16 h-16 flex-shrink-0 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 flex items-center justify-center transition-colors"
                              onClick={() => inputRef.current?.click()}
                            >
                              <Plus size={20} className="text-slate-400" />
                            </button>
                          )}
                        </div>

                        {/* Status / errors */}
                        {uploading && (
                          <p className="text-xs text-indigo-500 text-center font-medium">
                            Uploading {files.filter(f => !f.done && !f.error).length} photo{files.filter(f => !f.done && !f.error).length !== 1 ? 's' : ''}…
                          </p>
                        )}
                        {anyError && (
                          <p className="text-xs text-red-500 text-center font-medium">Some uploads failed — remove them and try again</p>
                        )}
                      </div>
                    )}

                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          className="rounded-xl px-4 py-3 text-sm text-red-600 flex items-start gap-2"
                          style={{ background: 'rgba(254,242,242,0.9)', border: '1px solid rgba(252,165,165,0.5)' }}
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-red-400" />
                          <span>{error}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Continue button */}
                    {files.length > 0 && (
                      <motion.button
                        className="btn-primary w-full"
                        onClick={() => setStep('compose')}
                        disabled={!canContinue}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                      >
                        {uploading
                          ? `Uploading… (${readyMedia.length}/${files.length})`
                          : `Continue with ${readyMedia.length} photo${readyMedia.length !== 1 ? 's' : ''} →`}
                      </motion.button>
                    )}

                    {/* Text-only shortcut */}
                    <button
                      className="text-center text-sm font-medium text-indigo-500 hover:text-indigo-700 transition-colors py-1"
                      onClick={() => setStep('compose')}
                    >
                      Write a text-only post instead
                    </button>

                    <input
                      ref={inputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      multiple hidden
                      onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ''; }}
                    />
                  </motion.div>
                )}

                {/* ══ STEP 2 — Compose ══ */}
                {step === 'compose' && (
                  <motion.div
                    key="compose"
                    className="p-4 flex flex-col gap-4 pb-6"
                    variants={pageVariants} initial="hidden" animate="visible" exit="exit"
                  >
                    {/* Thumbnail row */}
                    {files.filter(f => f.done).length > 0 && (
                      <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        {files.filter(f => f.done).map((f, i) => (
                          <div key={i} className="w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden">
                            <img src={f.preview} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                        <button
                          className="w-14 h-14 flex-shrink-0 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 flex items-center justify-center transition-colors"
                          onClick={() => setStep('pick')}
                          title="Edit photos"
                        >
                          <Camera size={16} className="text-slate-400" />
                        </button>
                      </div>
                    )}

                    {/* Caption */}
                    <div className="relative">
                      <textarea
                        ref={captionRef}
                        className="input-glass w-full resize-none"
                        style={{ borderRadius: 16, padding: '14px 16px' }}
                        placeholder={readyMedia.length ? 'Write a caption…' : "What's on your mind?"}
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        maxLength={2200}
                        rows={readyMedia.length ? 4 : 6}
                      />
                      <span className="absolute bottom-3 right-4 text-[10px] text-slate-400 font-medium pointer-events-none">
                        {caption.length}/2200
                      </span>
                    </div>

                    {/* Visibility */}
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Who can see this?</p>
                      <div className="flex flex-col gap-2">
                        {VIS_OPTS.map(({ key, label, Icon, desc }) => (
                          <motion.button
                            key={key}
                            type="button"
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all duration-200 ${
                              visibility === key
                                ? 'text-white'
                                : 'glass-hover text-slate-700'
                            }`}
                            style={visibility === key
                              ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }
                              : undefined}
                            onClick={() => setVisibility(key)}
                            whileTap={{ scale: 0.97 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                          >
                            <Icon size={18} className={visibility === key ? 'text-white' : 'text-indigo-500'} />
                            <div className="flex-1">
                              <p className={`text-sm font-semibold ${visibility === key ? 'text-white' : 'text-slate-800'}`}>{label}</p>
                              <p className={`text-xs ${visibility === key ? 'text-white/75' : 'text-slate-400'}`}>{desc}</p>
                            </div>
                            {visibility === key && (
                              <CheckCircle size={16} className="text-white flex-shrink-0" />
                            )}
                          </motion.button>
                        ))}
                      </div>

                      {visibility === 'NEARBY' && (
                        <div className="glass rounded-2xl p-4 flex flex-col gap-2 mt-1">
                          <p className="text-sm text-slate-700 font-medium">
                            Visible within <span className="gradient-text font-bold">{radius} km</span>
                          </p>
                          <input
                            type="range"
                            className="fx-slider w-full"
                            min={1} max={100} step={1}
                            value={radius}
                            onChange={e => setRadius(Number(e.target.value))}
                          />
                          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                            <span>1 km</span><span>50 km</span><span>100 km</span>
                          </div>
                          {!location && (
                            <p className="text-xs text-amber-500 flex items-center gap-1.5 mt-1">
                              <AlertCircle size={12} /> Location access required for nearby posts
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          className="rounded-xl px-4 py-3 text-sm text-red-600 flex items-start gap-2"
                          style={{ background: 'rgba(254,242,242,0.9)', border: '1px solid rgba(252,165,165,0.5)' }}
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-red-400" />{error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Share */}
                    <motion.button
                      className="btn-primary w-full"
                      onClick={submit}
                      disabled={submitting || (!caption.trim() && !readyMedia.length)}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                    >
                      {submitting ? 'Sharing…' : 'Share Post'}
                    </motion.button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
