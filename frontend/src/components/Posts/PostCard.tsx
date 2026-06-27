import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, Trash2 } from 'lucide-react';
import { Post } from '@/services/postService';
import postService from '@/services/postService';
import { useAuth } from '@/hooks/useAuth';
import { CarouselViewer } from '@/components/Media/CarouselViewer';
import { CommentsModal } from '@/components/Common/CommentsModal';
import { ShareSheet } from '@/components/Common/ShareSheet';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/* Deterministic gradient per userId */
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

interface PostCardProps {
  post:          Post;
  onDelete?:     (id: string) => void;
  onLikeChange?: (post: Post) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onDelete, onLikeChange }) => {
  const { user } = useAuth();
  const [current,      setCurrent]      = useState(post);
  const [showComments, setShowComments] = useState(false);
  const [showShare,    setShowShare]    = useState(false);
  const [liking,       setLiking]       = useState(false);

  const isOwner = user?.id === current.userId;
  const liked   = user ? current.likes.includes(user.id) : false;
  const initials = current.userId.slice(0, 2).toUpperCase();

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

  const primaryMedia = postService.getPrimaryMedia(current);

  return (
    <div className="glass-hover rounded-2xl overflow-hidden mb-3">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        {/* Avatar */}
        <div
          className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(current.userId)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            @user_{current.userId.slice(0, 6)}
          </p>
          <p className="text-xs text-slate-400">{timeAgo(current.createdAt)}</p>
        </div>

        {isOwner && (
          <button
            onClick={handleDelete}
            className="btn-icon w-8 h-8 rounded-lg text-slate-400 hover:text-red-500"
            aria-label="Delete post"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* ── Media ── */}
      {current.postMedia?.length > 0 && (
        <div className="mt-1">
          <CarouselViewer items={current.postMedia} />
        </div>
      )}

      {/* ── Caption (if no media, show above actions) ── */}
      {current.caption && current.postMedia?.length === 0 && (
        <p className="px-4 pt-2 text-sm text-slate-700 leading-relaxed">
          {current.caption}
        </p>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-0.5 px-3 py-2">
        <button
          onClick={handleLike}
          disabled={liking}
          className={`btn-icon w-9 h-9 transition-all duration-150 ${liked ? 'text-red-500 scale-110' : 'text-slate-400 hover:text-red-400'}`}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <Heart size={20} className={liked ? 'fill-red-500' : ''} />
        </button>

        <button
          onClick={() => setShowComments(true)}
          className="btn-icon w-9 h-9 text-slate-400 hover:text-indigo-500"
          aria-label="Comments"
        >
          <MessageCircle size={20} />
        </button>

        <button
          onClick={() => setShowShare(true)}
          className="btn-icon w-9 h-9 text-slate-400 hover:text-indigo-500"
          aria-label="Share"
        >
          <Share2 size={20} />
        </button>
      </div>

      {/* ── Likes count + Caption (with media) ── */}
      <div className="px-4 pb-4">
        {current.likesCount > 0 && (
          <p className="text-sm font-semibold text-slate-800 mb-1">
            {current.likesCount.toLocaleString()} like{current.likesCount !== 1 ? 's' : ''}
          </p>
        )}
        {current.caption && current.postMedia?.length > 0 && (
          <p className="text-sm text-slate-700 leading-relaxed">
            <span className="font-semibold">@user_{current.userId.slice(0, 6)}</span>{' '}
            {current.caption}
          </p>
        )}
      </div>

      {/* Modals */}
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
