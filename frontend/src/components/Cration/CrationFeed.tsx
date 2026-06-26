import React, { useEffect, useRef, useState, useCallback } from 'react';
import crationService, { Cration } from '@/services/crationService';
import { useAuth } from '@/hooks/useAuth';
import { CommentsModal } from '@/components/Common/CommentsModal';
import { ShareSheet } from '@/components/Common/ShareSheet';
import { Comment } from '@/services/postService';

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

  // Track view when cration becomes active
  useEffect(() => {
    const c = crations[activeIdx];
    if (c && !viewedRef.current.has(c.id)) {
      viewedRef.current.add(c.id);
      crationService.view(c.id).catch(() => {});
    }
  }, [activeIdx, crations]);

  // Load more when near end
  useEffect(() => {
    if (hasMore && activeIdx >= crations.length - 3) loadMore(page + 1);
  }, [activeIdx]);

  // Scroll snap observer
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
    el.querySelectorAll('.cration-slide').forEach(slide => observer.observe(slide));
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
    setCrations(prev => prev.map(c => c.id === id
      ? { ...c, commentsCount: (c.commentsCount ?? 0) + delta }
      : c,
    ));
  };

  const handleShareCount = (id: string) => {
    setCrations(prev => prev.map(c => c.id === id
      ? { ...c, sharesCount: (c.sharesCount ?? 0) + 1 }
      : c,
    ));
    crationService.trackShare(id);
  };

  if (crations.length === 0 && !loading) {
    return (
      <div className="cration-feed-overlay">
        <div className="cration-feed-topbar">
          <button className="cration-feed-topbar__close" onClick={onClose}>✕</button>
          <span className="cration-feed-topbar__title">Crations</span>
          <button className="cration-feed-topbar__create" onClick={onCreateNew}>+ Create</button>
        </div>
        <div className="cration-empty">
          <div className="cration-empty__icon">🎬</div>
          <p className="cration-empty__title">No crations yet</p>
          <p className="cration-empty__sub">Be the first to share a moment</p>
          <button className="cration-submit" onClick={onCreateNew}>🚀 Create Cration</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="cration-feed-overlay">
        <div className="cration-feed-topbar">
          <button className="cration-feed-topbar__close" onClick={onClose}>✕</button>
          <span className="cration-feed-topbar__title">✨ Crations</span>
          <button className="cration-feed-topbar__create" onClick={onCreateNew}>+ Create</button>
        </div>

        <div className="cration-scroll" ref={containerRef}>
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
            <div className="cration-slide cration-slide--loading">
              <div className="cration-spinner" />
            </div>
          )}
        </div>
      </div>

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const liked   = !!currentUserId && cration.likes.includes(currentUserId);
  const isOwner = currentUserId === cration.userId;
  const videoSrc = crationService.getVideoUrl(cration.videoUrl);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) v.play().catch(() => {});
    else { v.pause(); v.currentTime = 0; }
  }, [isActive]);

  return (
    <div className="cration-slide" data-idx={idx}>
      <video
        ref={videoRef}
        src={videoSrc}
        className="cration-slide__video"
        loop playsInline
        muted={muted}
      />

      <button className="cration-slide__mute" onClick={() => setMuted(m => !m)}>
        {muted ? '🔇' : '🔊'}
      </button>

      <div className="cration-slide__actions">
        <button className={`cration-action ${liked ? 'cration-action--liked' : ''}`} onClick={onLike}>
          <span className="cration-action__icon">{liked ? '❤️' : '🤍'}</span>
          <span className="cration-action__count">{cration.likesCount}</span>
        </button>
        <button className="cration-action" onClick={onComment}>
          <span className="cration-action__icon">💬</span>
        </button>
        <button className="cration-action" onClick={onShare}>
          <span className="cration-action__icon">📤</span>
        </button>
        <div className="cration-action">
          <span className="cration-action__icon">👁️</span>
          <span className="cration-action__count">{cration.views}</span>
        </div>
        {isOwner && (
          <button className="cration-action cration-action--delete" onClick={onDelete}>
            <span className="cration-action__icon">🗑️</span>
          </button>
        )}
      </div>

      <div className="cration-slide__info">
        <div className="cration-slide__user">@user_{cration.userId.slice(0, 6)}</div>
        {cration.caption && <p className="cration-slide__caption">{cration.caption}</p>}
      </div>
    </div>
  );
};
