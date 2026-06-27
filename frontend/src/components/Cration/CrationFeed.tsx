import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Plus, Heart, MessageCircle, Share2, Eye, Trash2, Volume2, VolumeX, Film, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import crationService, { Cration } from '@/services/crationService';
import { useAuth } from '@/hooks/useAuth';
import { CommentsModal } from '@/components/Common/CommentsModal';
import { ShareSheet } from '@/components/Common/ShareSheet';
import { Comment } from '@/services/postService';
import { overlayVariants } from '@/utils/animations';

interface CrationFeedProps {
  onClose:     () => void;
  onCreateNew: () => void;
}

export const CrationFeed: React.FC<CrationFeedProps> = ({ onClose, onCreateNew }) => {
  const { user }    = useAuth();
  const [crations,  setCrations]  = useState<Cration[]>([]);
  const [page,      setPage]      = useState(1);
  const [hasMore,   setHasMore]   = useState(true);
  const [loading,   setLoading]   = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewedRef    = useRef<Set<string>>(new Set());
  const loadingRef   = useRef(false);

  const [commentCration, setCommentCration] = useState<Cration | null>(null);
  const [shareCration,   setShareCration]   = useState<Cration | null>(null);

  const loadMore = useCallback(async (p: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await crationService.getFeed(p, 10);
      setCrations(prev => p === 1 ? data.crations : [...prev, ...data.crations]);
      setHasMore(data.hasMore);
      setPage(p);
    } catch {}
    setLoading(false);
    loadingRef.current = false;
  }, []);

  useEffect(() => { loadMore(1); }, []);

  useEffect(() => {
    const c = crations[activeIdx];
    if (c && !viewedRef.current.has(c.id)) {
      viewedRef.current.add(c.id);
      crationService.view(c.id).catch(() => {});
    }
  }, [activeIdx, crations]);

  useEffect(() => {
    if (hasMore && activeIdx >= crations.length - 3) loadMore(page + 1);
  }, [activeIdx]);

  // Snap observer — uses data-idx attribute, no CSS class dependency
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = parseInt((entry.target as HTMLElement).dataset.idx || '0', 10);
          setActiveIdx(idx);
        }
      }),
      { root: el, threshold: 0.6 },
    );
    el.querySelectorAll('[data-idx]').forEach(slide => observer.observe(slide));
    return () => observer.disconnect();
  }, [crations.length]);

  const handleLike = async (id: string) => {
    const c = crations.find(x => x.id === id);
    if (!c || !user) return;
    const liked = c.likes.includes(user.id);
    try {
      const updated = liked ? await crationService.unlike(id) : await crationService.like(id);
      setCrations(prev => prev.map(x => x.id === id ? updated : x));
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await crationService.remove(id);
      setCrations(prev => prev.filter(x => x.id !== id));
    } catch {}
  };

  const handleCommentCountChange = (id: string, delta: number) => {
    setCrations(prev => prev.map(c =>
      c.id === id ? { ...c, commentsCount: (c.commentsCount ?? 0) + delta } : c,
    ));
  };

  const handleShareCount = (id: string) => {
    setCrations(prev => prev.map(c =>
      c.id === id ? { ...c, sharesCount: (c.sharesCount ?? 0) + 1 } : c,
    ));
    crationService.trackShare(id);
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-slate-950 flex flex-col"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* ── Top bar ─────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-safe"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
        >
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full glass-dark flex items-center justify-center text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="glass-dark rounded-full px-4 py-1.5 flex items-center gap-1.5">
            <Sparkles size={13} className="text-violet-400" />
            <span className="text-white text-sm font-semibold tracking-tight">Crations</span>
          </div>

          <button
            onClick={onCreateNew}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
          >
            <Plus size={14} />
            Create
          </button>
        </div>

        {/* ── Empty state ─────────────────────────────────────── */}
        {crations.length === 0 && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
            <div className="w-20 h-20 rounded-3xl glass-dark flex items-center justify-center">
              <Film size={36} className="text-violet-400" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-white font-bold text-lg">No crations yet</p>
              <p className="text-white/50 text-sm">Be the first to share a moment</p>
            </div>
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
            >
              <Plus size={16} />
              Create Cration
            </button>
          </div>
        )}

        {/* ── Snap scroll container ────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-scroll"
          style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}
        >
          {crations.map((c, idx) => (
            <CrationSlide
              key={c.id}
              cration={c}
              idx={idx}
              isActive={idx === activeIdx}
              currentUserId={user?.id}
              onLike={() => handleLike(c.id)}
              onDelete={() => handleDelete(c.id)}
              onComment={() => setCommentCration(c)}
              onShare={() => setShareCration(c)}
            />
          ))}

          {loading && (
            <div
              className="flex items-center justify-center bg-slate-950"
              style={{ height: '100dvh', scrollSnapAlign: 'start' }}
            >
              <div className="w-10 h-10 rounded-full border-4 border-violet-900 border-t-violet-400 animate-spin" />
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Comment sheet ──────────────────────────────────────── */}
      {commentCration && (
        <CommentsModal
          parentId={commentCration.id}
          parentType="cration"
          commentsCount={commentCration.commentsCount ?? 0}
          onCountChange={d => handleCommentCountChange(commentCration.id, d)}
          onClose={() => setCommentCration(null)}
          getComments={id => crationService.getComments(id) as Promise<Comment[]>}
          addComment={(id, text) => crationService.addComment(id, text) as Promise<Comment>}
          deleteComment={(id, cid) => crationService.deleteComment(id, cid)}
        />
      )}

      {/* ── Share sheet ────────────────────────────────────────── */}
      {shareCration && (
        <ShareSheet
          type="cration"
          id={shareCration.id}
          text={shareCration.caption}
          mediaUrl={crationService.getVideoUrl(shareCration.videoUrl)}
          mediaType="video"
          onShare={() => handleShareCount(shareCration.id)}
          onClose={() => setShareCration(null)}
        />
      )}
    </>
  );
};

/* ════════════════════════════════════════════════════════════════
   CrationSlide — individual full-screen video card
   ════════════════════════════════════════════════════════════════ */
interface SlideProps {
  cration:        Cration;
  idx:            number;
  isActive:       boolean;
  currentUserId?: string;
  onLike:         () => void;
  onDelete:       () => void;
  onComment:      () => void;
  onShare:        () => void;
}

const CrationSlide: React.FC<SlideProps> = ({
  cration, idx, isActive, currentUserId, onLike, onDelete, onComment, onShare,
}) => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLikedLocal] = useState(
    !!currentUserId && cration.likes.includes(currentUserId),
  );

  const isOwner  = currentUserId === cration.userId;
  const videoSrc = crationService.getVideoUrl(cration.videoUrl);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) v.play().catch(() => {});
    else { v.pause(); v.currentTime = 0; }
  }, [isActive]);

  const handleLike = () => {
    setLikedLocal(l => !l);
    onLike();
  };

  return (
    <div
      data-idx={idx}
      className="relative bg-slate-950 overflow-hidden"
      style={{ height: '100dvh', scrollSnapAlign: 'start' }}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={videoSrc}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        playsInline
        muted={muted}
      />

      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.20) 45%, transparent 70%)' }}
      />

      {/* ── Right action sidebar ───────────────────────────── */}
      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Like */}
        <ActionBtn
          onClick={handleLike}
          icon={
            <Heart
              size={24}
              className={liked ? 'fill-rose-500 text-rose-500' : 'text-white'}
            />
          }
          count={cration.likesCount}
          active={liked}
        />

        {/* Comment */}
        <ActionBtn onClick={onComment} icon={<MessageCircle size={24} className="text-white" />} />

        {/* Share */}
        <ActionBtn onClick={onShare} icon={<Share2 size={24} className="text-white" />} />

        {/* Views */}
        <ActionBtn
          icon={<Eye size={22} className="text-white/70" />}
          count={cration.views}
          noHover
        />

        {/* Delete (owner only) */}
        {isOwner && (
          <ActionBtn
            onClick={onDelete}
            icon={<Trash2 size={22} className="text-rose-400" />}
          />
        )}
      </div>

      {/* ── Bottom-left info ───────────────────────────────── */}
      <div className="absolute left-4 bottom-28 right-20 z-10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <p className="text-white font-bold text-sm drop-shadow-lg">
          @user_{cration.userId.slice(0, 6)}
        </p>
        {cration.caption && (
          <p className="text-white/80 text-sm mt-1 leading-snug line-clamp-3 drop-shadow">
            {cration.caption}
          </p>
        )}
      </div>

      {/* ── Mute toggle ───────────────────────────────────── */}
      <button
        onClick={() => setMuted(m => !m)}
        className="absolute bottom-10 right-4 z-10 w-9 h-9 rounded-full glass-dark flex items-center justify-center text-white/80 hover:text-white transition-colors"
        aria-label={muted ? 'Unmute' : 'Mute'}
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </div>
  );
};

/* ── Reusable action button ─────────────────────────────────────── */
const ActionBtn: React.FC<{
  icon:     React.ReactNode;
  count?:   number;
  active?:  boolean;
  noHover?: boolean;
  onClick?: () => void;
}> = ({ icon, count, active, noHover, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 group ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <div className={`w-11 h-11 rounded-2xl glass-dark flex items-center justify-center transition-transform ${
      !noHover && onClick ? 'group-hover:scale-110 group-active:scale-95' : ''
    } ${active ? 'ring-1 ring-rose-500/60' : ''}`}>
      {icon}
    </div>
    {count !== undefined && (
      <span className="text-white text-[11px] font-semibold leading-none drop-shadow">
        {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
      </span>
    )}
  </button>
);
