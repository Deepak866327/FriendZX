import React, { useState } from 'react';
import { Post } from '@/services/postService';
import postService from '@/services/postService';
import { useAuth } from '@/hooks/useAuth';
import { CarouselViewer } from '@/components/Media/CarouselViewer';
import { CommentsModal } from '@/components/Common/CommentsModal';
import { ShareSheet } from '@/components/Common/ShareSheet';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

interface PostCardProps {
  post:           Post;
  onDelete?:      (id: string) => void;
  onLikeChange?:  (post: Post) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onDelete, onLikeChange }) => {
  const { user } = useAuth();
  const [current, setCurrent] = useState(post);
  const [showComments, setShowComments] = useState(false);
  const [showShare,    setShowShare]    = useState(false);
  const [liking,       setLiking]       = useState(false);

  const isOwner = user?.id === current.userId;
  const liked   = user ? current.likes.includes(user.id) : false;

  const handleLike = async () => {
    if (!user || liking) return;
    setLiking(true);
    try {
      const updated = liked
        ? await postService.unlikePost(current.id)
        : await postService.likePost(current.id);
      setCurrent(updated);
      onLikeChange?.(updated);
    } catch {}
    setLiking(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return;
    try {
      await postService.deletePost(current.id);
      onDelete?.(current.id);
    } catch {}
  };

  // Primary media for the share sheet URL
  const primaryMedia = postService.getPrimaryMedia(current);

  return (
    <div className="post-card">
      {/* Header */}
      <div className="post-card__header">
        <div className="post-card__avatar">{current.userId.slice(0, 2).toUpperCase()}</div>
        <div className="post-card__meta">
          <span className="post-card__uid">@user_{current.userId.slice(0, 6)}</span>
          <span className="post-card__time">{timeAgo(current.createdAt)}</span>
        </div>
        {isOwner && (
          <button className="post-card__more" onClick={handleDelete} title="Delete">🗑️</button>
        )}
      </div>

      {/* Media */}
      {current.postMedia?.length > 0 && (
        <div className="post-card__media">
          <CarouselViewer items={current.postMedia} />
        </div>
      )}

      {/* Actions */}
      <div className="post-card__actions">
        <button
          className={`post-card__action${liked ? ' post-card__action--liked' : ''}`}
          onClick={handleLike}
          disabled={liking}
        >
          {liked ? '❤️' : '🤍'}
          <span className="post-card__action-count">{current.likesCount}</span>
        </button>

        <button className="post-card__action" onClick={() => setShowComments(true)}>
          💬
        </button>

        <button className="post-card__action" onClick={() => setShowShare(true)}>
          📤
        </button>
      </div>

      {/* Caption */}
      {current.likesCount > 0 && (
        <p className="post-card__likes-count">{current.likesCount.toLocaleString()} like{current.likesCount !== 1 ? 's' : ''}</p>
      )}
      {current.caption && (
        <p className="post-card__caption">
          <span className="post-card__caption-user">@user_{current.userId.slice(0, 6)}</span>{' '}
          {current.caption}
        </p>
      )}

      {/* Comment sheet */}
      {showComments && (
        <CommentsModal
          parentId={current.id}
          parentType="post"
          commentsCount={0}
          onCountChange={() => {}}
          onClose={() => setShowComments(false)}
          getComments={id => postService.getComments(id) as any}
          addComment={(id, text) => postService.addComment(id, text) as any}
          deleteComment={(id, cid) => postService.deleteComment(id, cid) as any}
        />
      )}

      {/* Share sheet */}
      {showShare && (
        <ShareSheet
          type="post"
          id={current.id}
          text={current.caption || ''}
          mediaUrl={primaryMedia?.media.url}
          mediaType={primaryMedia?.media.mediaType === 'VIDEO' ? 'video' : 'image'}
          onShare={() => {}}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
};
