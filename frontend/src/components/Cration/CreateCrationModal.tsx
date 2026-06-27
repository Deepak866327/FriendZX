import React, { useState, useRef, useEffect } from 'react';
import {
  X, Video, ImagePlus, Globe, Users, MapPin,
  Maximize2, Square, Smartphone, Monitor, Check,
  Upload, RefreshCw, AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ASPECT_RATIOS, AspectRatioKey } from '@/components/Common/ImageCropper';
import { getApiToken } from '@/services/api';
import { overlayVariants, sheetVariants } from '@/utils/animations';

type Visibility = 'public' | 'friends' | 'nearby';

interface CreateCrationModalProps {
  onClose:   () => void;
  onCreated: () => void;
}

const AR_ICONS: Record<AspectRatioKey, React.ReactNode> = {
  'original': <Maximize2  size={13} />,
  '1:1':      <Square     size={13} />,
  '4:5':      <Smartphone size={13} />,
  '16:9':     <Monitor    size={13} />,
};

const VIS_OPTIONS: { key: Visibility; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'public',  label: 'Public',  icon: <Globe   size={15} />, desc: 'Everyone' },
  { key: 'friends', label: 'Friends', icon: <Users   size={15} />, desc: 'Followers' },
  { key: 'nearby',  label: 'Nearby',  icon: <MapPin  size={15} />, desc: 'Near you' },
];

export const CreateCrationModal: React.FC<CreateCrationModalProps> = ({ onClose, onCreated }) => {
  const [caption,      setCaption]      = useState('');
  const [frameAr,      setFrameAr]      = useState<AspectRatioKey>('original');
  const [videoFile,    setVideoFile]    = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbFile,    setThumbFile]    = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [visibility,   setVisibility]   = useState<Visibility>('public');
  const [nearbyRadius, setNearbyRadius] = useState(10);
  const [userLat,      setUserLat]      = useState<number | null>(null);
  const [userLng,      setUserLng]      = useState<number | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [uploadPct,    setUploadPct]    = useState(0);

  const videoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visibility === 'nearby' && userLat == null) {
      navigator.geolocation?.getCurrentPosition(
        pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
        () => {},
      );
    }
  }, [visibility]);

  const handleVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { setError('Please select a video file'); return; }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleThumb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) { setError('Please select a video'); return; }
    setLoading(true); setError('');
    try {
      const form = new FormData();
      form.append('caption', caption);
      form.append('video', videoFile);
      if (thumbFile) form.append('thumbnail', thumbFile);
      form.append('visibility', visibility);
      if (visibility === 'nearby') {
        form.append('nearbyRadius', String(nearbyRadius));
        if (userLat != null) form.append('latitude',  String(userLat));
        if (userLng != null) form.append('longitude', String(userLng));
      }

      await new Promise<void>((resolve, reject) => {
        const xhr   = new XMLHttpRequest();
        const token = getApiToken() || '';
        xhr.open('POST', '/api/crations');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = ev => {
          if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload  = () => xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(JSON.parse(xhr.responseText)?.error || 'Upload failed'));
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(form);
      });

      if (videoPreview) URL.revokeObjectURL(videoPreview);
      if (thumbPreview) URL.revokeObjectURL(thumbPreview);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload cration');
    } finally {
      setLoading(false);
      setUploadPct(0);
    }
  };

  const arDef = ASPECT_RATIOS.find(a => a.key === frameAr)!;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        style={{ background: 'rgba(15,10,40,0.55)', backdropFilter: 'blur(6px)' }}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      >
        <motion.div
          className="glass-strong rounded-t-3xl flex flex-col w-full"
          style={{ maxHeight: '95dvh' }}
          variants={sheetVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-300/70" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/30 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <Video size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 leading-tight">New Cration</p>
                <p className="text-[11px] text-slate-400 leading-tight">Share your moment</p>
              </div>
            </div>
            <button className="btn-icon text-slate-500" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Scrollable body */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5 pb-safe"
          >
            {/* ── Video picker ───────────────────────────────── */}
            {!videoFile ? (
              <button
                type="button"
                onClick={() => videoRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-3 py-12 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/70 active:scale-[0.98] transition-all"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
                  <Video size={28} className="text-indigo-500" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-700">Tap to select video</p>
                  <p className="text-xs text-slate-400">MP4, MOV, WebM · up to 200 MB</p>
                </div>
              </button>
            ) : (
              <div className="space-y-3">
                {/* Framed preview */}
                <div
                  className="relative rounded-2xl overflow-hidden bg-slate-950 w-full"
                  style={{ aspectRatio: arDef.w > 0 ? `${arDef.w}/${arDef.h}` : 'auto' }}
                >
                  <video
                    src={videoPreview!}
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Aspect ratio pills */}
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {ASPECT_RATIOS.map(({ key, label }) => {
                    const active = frameAr === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFrameAr(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          active
                            ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200/60'
                            : 'glass text-slate-600 hover:bg-white/70'
                        }`}
                      >
                        {active ? <Check size={12} /> : AR_ICONS[key]}
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Change video */}
                <button
                  type="button"
                  onClick={() => videoRef.current?.click()}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/60 transition-colors"
                >
                  <RefreshCw size={13} />
                  Change video
                </button>
              </div>
            )}
            <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={handleVideo} />

            {/* ── Thumbnail ──────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cover image</p>
              <button
                type="button"
                onClick={() => thumbRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl hover:bg-white/70 transition-colors"
              >
                {thumbPreview ? (
                  <>
                    <img src={thumbPreview} alt="cover" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700">Change cover image</span>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center flex-shrink-0">
                      <ImagePlus size={18} className="text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Add cover image</p>
                      <p className="text-xs text-slate-400">Optional · shown in grid</p>
                    </div>
                  </>
                )}
              </button>
              <input ref={thumbRef} type="file" accept="image/*" className="hidden" onChange={handleThumb} />
            </div>

            {/* ── Caption ────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Caption</p>
              <div className="relative">
                <textarea
                  className="input-glass w-full resize-none text-sm"
                  style={{ borderRadius: '1rem', paddingBottom: '1.75rem' }}
                  placeholder="Write a caption… #trending ✨"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  rows={3}
                  maxLength={300}
                />
                <span className="absolute bottom-2.5 right-3 text-[11px] text-slate-400 pointer-events-none">
                  {caption.length}/300
                </span>
              </div>
            </div>

            {/* ── Visibility ─────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Who can see this?</p>
              <div className="grid grid-cols-3 gap-2">
                {VIS_OPTIONS.map(({ key, label, icon, desc }) => {
                  const active = visibility === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setVisibility(key)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl text-xs font-semibold transition-all ${
                        active
                          ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200/60'
                          : 'glass text-slate-600 hover:bg-white/70'
                      }`}
                    >
                      <span className={active ? 'text-white' : 'text-indigo-500'}>{icon}</span>
                      <span>{label}</span>
                      <span className={`font-normal text-[10px] ${active ? 'text-white/70' : 'text-slate-400'}`}>
                        {desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Nearby radius */}
              <AnimatePresence>
                {visibility === 'nearby' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 space-y-2 overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-600 font-medium">Visible within</p>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                        {nearbyRadius} km
                      </span>
                    </div>
                    <input
                      type="range"
                      className="fx-slider w-full"
                      min={1} max={100} step={1}
                      value={nearbyRadius}
                      onChange={e => setNearbyRadius(Number(e.target.value))}
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 px-0.5">
                      <span>1 km</span>
                      <span>50 km</span>
                      <span>100 km</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Error ──────────────────────────────────────── */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200/60"
                >
                  <AlertCircle size={15} className="text-rose-500 flex-shrink-0" />
                  <p className="text-sm text-rose-600">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Upload progress ────────────────────────────── */}
            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-600">Uploading…</span>
                  <span className="text-indigo-600">{uploadPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* ── Submit ─────────────────────────────────────── */}
            <button
              type="submit"
              className="btn-primary w-full gap-2"
              disabled={loading || !videoFile}
            >
              {loading ? (
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {loading ? `Uploading ${uploadPct}%` : 'Share Cration'}
            </button>

            {/* bottom breathing room */}
            <div className="h-2" />
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
