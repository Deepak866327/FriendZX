import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Eye, Globe, Lock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Story, StoryGroup, storyService, resolveStoryMediaUrl } from '@/services/storyService';
import { useAuth } from '@/hooks/useAuth';

const STORY_DURATION_MS = 5000;

function timeAgo(dateStr: string) {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-purple-600',
  'from-sky-400 to-blue-500',
  'from-pink-500 to-rose-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
];
function avatarGradient(uid: string) {
  const n = uid.charCodeAt(0) + uid.charCodeAt(uid.length - 1);
  return GRADIENTS[n % GRADIENTS.length];
}

const VIS_INFO: Record<string, { label: string; Icon: React.ElementType; cls: string }> = {
  public:  { label: 'Public',  Icon: Globe,  cls: 'text-emerald-300 bg-emerald-900/40' },
  friends: { label: 'Friends', Icon: Lock,   cls: 'text-indigo-300 bg-indigo-900/40' },
  nearby:  { label: 'Nearby',  Icon: MapPin, cls: 'text-amber-300 bg-amber-900/40' },
};

interface Props {
  groups:          StoryGroup[];
  startGroupIndex: number;
  onClose:         () => void;
  onStoryViewed?:  (storyId: string) => void;
}

export const StoryViewer: React.FC<Props> = ({ groups, startGroupIndex, onClose, onStoryViewed }) => {
  const { user } = useAuth();
  const [open,     setOpen]     = useState(true);
  const [groupIdx, setGroupIdx] = useState(startGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused,   setPaused]   = useState(false);

  const timerRef   = useRef<ReturnType<typeof setInterval>>();
  const startRef   = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];

  useEffect(() => {
    if (!story) return;
    storyService.viewStory(story.id).catch(() => {});
    onStoryViewed?.(story.id);
  }, [story?.id]);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = elapsedRef.current + (Date.now() - startRef.current);
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) advance();
    }, 50);
  }, []);

  const stopTimer = useCallback(() => {
    elapsedRef.current += Date.now() - startRef.current;
    clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    if (!paused) startTimer();
    return () => clearInterval(timerRef.current);
  }, [storyIdx, groupIdx]);

  useEffect(() => {
    if (paused) stopTimer();
    else startTimer();
  }, [paused]);

  const advance = useCallback(() => {
    elapsedRef.current = 0;
    setProgress(0);
    if (storyIdx < (group?.stories.length ?? 0) - 1) {
      setStoryIdx(i => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(g => g + 1);
      setStoryIdx(0);
    } else {
      setOpen(false);
    }
  }, [storyIdx, groupIdx, groups, group]);

  const retreat = useCallback(() => {
    elapsedRef.current = 0;
    setProgress(0);
    if (storyIdx > 0) {
      setStoryIdx(i => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx(g => g - 1);
      setStoryIdx(0);
    }
  }, [storyIdx, groupIdx]);

  const handleAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 2) retreat();
    else advance();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     setOpen(false);
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft')  retreat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, retreat]);

  const canPrev = groupIdx > 0 || storyIdx > 0;
  const canNext = groupIdx < groups.length - 1 || storyIdx < (group?.stories.length ?? 0) - 1;

  if (!group || !story) return null;

  const isOwn       = user?.id === group.userId;
  const displayName = group.firstName
    ? `${group.firstName}${group.lastName ? ' ' + group.lastName : ''}`
    : group.userId.slice(0, 8);
  const mediaUrl = resolveStoryMediaUrl(story.mediaUrl);
  const vis      = VIS_INFO[story.visibility] ?? VIS_INFO.public;
  const VisIcon  = vis.Icon;

  return (
    <AnimatePresence onExitComplete={onClose}>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setOpen(false)}
        >
          {/* Prev/Next group arrows — desktop only */}
          {canPrev && (
            <button
              className="hidden md:flex absolute left-4 z-30 w-10 h-10 rounded-full items-center justify-center text-white bg-white/10 hover:bg-white/20 transition-colors"
              onClick={e => { e.stopPropagation(); retreat(); }}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {canNext && (
            <button
              className="hidden md:flex absolute right-4 z-30 w-10 h-10 rounded-full items-center justify-center text-white bg-white/10 hover:bg-white/20 transition-colors"
              onClick={e => { e.stopPropagation(); advance(); }}
            >
              <ChevronRight size={20} />
            </button>
          )}

          {/* Story card */}
          <motion.div
            className="relative w-full max-w-sm h-full max-h-[100dvh] md:max-h-[88dvh] md:rounded-3xl overflow-hidden bg-black select-none"
            initial={{ scale: 0.94, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            onClick={e => e.stopPropagation()}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          >

            {/* ── Media ── */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${groupIdx}-${storyIdx}`}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {story.mediaType === 'image' ? (
                  <img
                    src={mediaUrl}
                    alt="story"
                    className="absolute inset-0 w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <video
                    src={mediaUrl}
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    playsInline
                    onEnded={advance}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* ── Top gradient scrim ── */}
            <div
              className="absolute top-0 left-0 right-0 h-32 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)' }}
            />

            {/* ── Progress bars ── */}
            <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-3 pointer-events-none">
              {group.stories.map((_, i) => (
                <div key={i} className="h-[2.5px] flex-1 rounded-full bg-white/30 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{
                      width: i < storyIdx ? '100%' : i === storyIdx ? `${progress}%` : '0%',
                      transition: i === storyIdx ? 'none' : undefined,
                    }}
                  />
                </div>
              ))}
            </div>

            {/* ── Header ── */}
            <div className="absolute top-3 left-0 right-0 z-20 flex items-center gap-2.5 px-3 pt-5">
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(group.userId)} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 ring-[1.5px] ring-white/60`}
              >
                {group.photo
                  ? <img src={group.photo} alt="" className="w-full h-full rounded-full object-cover" />
                  : (group.firstName || group.userId).charAt(0).toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-[13px] leading-none truncate">{displayName}</p>
                <p className="text-white/60 text-[10px] mt-0.5">{timeAgo(story.createdAt)}</p>
              </div>
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setOpen(false); }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Click zones (tap left/right to navigate) ── */}
            <div
              className="absolute inset-0 z-10 flex"
              onClick={handleAreaClick}
            >
              <div className="w-1/2 h-full" />
              <div className="w-1/2 h-full" />
            </div>

            {/* ── Bottom gradient scrim ── */}
            <div
              className="absolute bottom-0 left-0 right-0 h-40 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)' }}
            />

            {/* ── Bottom overlay: caption + meta ── */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-8 pt-6 pointer-events-none">
              {story.text && (
                <p className="text-white text-sm font-medium leading-relaxed mb-3 drop-shadow">
                  {story.text}
                </p>
              )}
              <div className="flex items-center justify-between">
                {isOwn ? (
                  <div className="flex items-center gap-1 text-white/70 text-xs">
                    <Eye size={11} />
                    <span>{story.viewCount} {story.viewCount === 1 ? 'view' : 'views'}</span>
                  </div>
                ) : <div />}
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-[3px] rounded-full ${vis.cls}`}>
                  <VisIcon size={9} />
                  {vis.label}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
