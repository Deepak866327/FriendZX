import React, { useRef, useEffect, useState } from 'react';
import crationService, { Cration } from '@/services/crationService';
import { useAuth } from '@/hooks/useAuth';
import { CommentsModal } from '@/components/Common/CommentsModal';
import { ShareSheet } from '@/components/Common/ShareSheet';
import { Comment } from '@/services/postService';

interface Props {
  cration: Cration;
  onClose: () => void;
}

export const CrationPlayerModal: React.FC<Props> = ({ cration: initial, onClose }) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted]                 = useState(false);
  const [cration, setCration]             = useState(initial);
  const [commentsCount, setCommentsCount] = useState(initial.commentsCount ?? 0);
  const [sharesCount, setSharesCount]     = useState(initial.sharesCount ?? 0);
  const [showComments, setShowComments]   = useState(false);
  const [showShare, setShowShare]         = useState(false);

  const liked = !!user && cration.likes.includes(user.id);
  const isOwner = user?.id === cration.userId;
  const videoSrc = crationService.getVideoUrl(cration.videoUrl);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
    crationService.view(cration.id).catch(() => {});
  }, [cration.id]);

  const handleLike = async () => {
    try {
      const updated = liked
        ? await crationService.unlike(cration.id)
        : await crationService.like(cration.id);
      setCration(updated);
    } catch {}
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this cration?')) return;
    try {
      await crationService.remove(cration.id);
      onClose();
    } catch {}
  };

  return (
    <div className="cration-feed-overlay" onClick={onClose}>
      <div className="cration-feed-topbar">
        <button className="cration-feed-topbar__close" onClick={onClose}>✕</button>
        <span className="cration-feed-topbar__title">🎬 Cration</span>
        <span />
      </div>

      <div
        className="cration-scroll"
        style={{ scrollSnapType: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="cration-slide" style={{ height: 'calc(100vh - 56px)' }}>
          <video
            ref={videoRef}
            src={videoSrc}
            className="cration-slide__video"
            loop
            playsInline
            muted={muted}
            autoPlay
          />

          <button className="cration-slide__mute" onClick={() => setMuted(m => !m)}>
            {muted ? '🔇' : '🔊'}
          </button>

          <div className="cration-slide__actions">
            <button className={`cration-action${liked ? ' cration-action--liked' : ''}`} onClick={handleLike}>
              <span className="cration-action__icon">{liked ? '❤️' : '🤍'}</span>
              <span className="cration-action__count">{cration.likesCount}</span>
            </button>

            <button className="cration-action" onClick={() => setShowComments(true)}>
              <span className="cration-action__icon">💬</span>
            </button>

            <button className="cration-action" onClick={() => setShowShare(true)}>
              <span className="cration-action__icon">📤</span>
            </button>

            <div className="cration-action">
              <span className="cration-action__icon">👁️</span>
              <span className="cration-action__count">{cration.views}</span>
            </div>

            {isOwner && (
              <button className="cration-action cration-action--delete" onClick={handleDelete}>
                <span className="cration-action__icon">🗑️</span>
              </button>
            )}
          </div>

          <div className="cration-slide__info">
            <div className="cration-slide__user">@user_{cration.userId.slice(0, 6)}</div>
            {cration.caption && <p className="cration-slide__caption">{cration.caption}</p>}
          </div>
        </div>
      </div>

      {showComments && (
        <CommentsModal
          parentId={cration.id}
          parentType="cration"
          commentsCount={commentsCount}
          onCountChange={d => setCommentsCount(c => c + d)}
          onClose={() => setShowComments(false)}
          getComments={id => crationService.getComments(id) as Promise<Comment[]>}
          addComment={(id, text) => crationService.addComment(id, text) as Promise<Comment>}
          deleteComment={(id, cid) => crationService.deleteComment(id, cid)}
        />
      )}

      {showShare && (
        <ShareSheet
          type="cration"
          id={cration.id}
          text={cration.caption}
          mediaUrl={crationService.getVideoUrl(cration.videoUrl)}
          mediaType="video"
          onShare={() => { setSharesCount(s => s + 1); crationService.trackShare(cration.id); }}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
};
