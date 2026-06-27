import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, Trash2, MapPin, Globe, Lock, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Post } from '@/services/postService';
import postService from '@/services/postService';
import { useAuth } from '@/hooks/useAuth';
import { CarouselViewer } from '@/components/Media/CarouselViewer';
import { CommentsModal } from '@/components/Common/CommentsModal';
import { ShareSheet } from '@/components/Common/ShareSheet';

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
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
  PUBLIC:  { label: 'Public',  Icon: Globe,   cls: 'text-emerald-600 bg-emerald-50/80' },
  FRIENDS: { label: 'Friends', Icon: Lock,    cls: 'text-indigo-600 bg-indigo-50/80' },
  NEARBY:  { label: 'Nearby',  Icon: MapPin,  cls: 'text-amber-600 bg-amber-50/80' },
  PRIVATE: { label: 'Private', Icon: EyeOff,  cls: 'text-slate-500 bg-slate-100/80' },
};

const SPRING = { type: 'spring', damping: 14, stiffness: 500 } as const;

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
  const vis      = VIS_INFO[current.visibility] ?? VIS_INFO.PUBLIC;
  const VisIcon  = vis.Icon;

  const handleLike = async () => {
    if (!user || liking) return;
    setLiking(true);
    const wasLiked = liked;
    // optimistic update
    setCurrent(prev => ({
      ...prev,
      likes:      wasLiked ? prev.likes.filter(id => id !== user.id) : [...prev.likes, user.id],
      likesCount: prev.likesCount + (wasLiked ? -1 : 1),
    }));
    try {
      const updated = wasLiked
        ? await postService.unlikePost(current.id)
        : await postService.likePost(current.id);
      setCurrent(updated);
      onLikeChange?.(updated);
    } catch {
      // revert
      setCurrent(prev => ({
        ...prev,
        likes:      wasLiked ? [...prev.likes, user.id] : prev.likes.filter(id => id !== user.id),
        likesCount: prev.likesCount + (wasLiked ? 1 : -1),
      }));
    } finally {
      setLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return;
    try {
      await postService.deletePost(current.id);
      onDelete?.(current.id);
    } catch {}
  };

  const primaryMedia = postService.getPrimaryMedia(current);
  const hasMedia     = current.postMedia?.length > 0;

  return (
    <div className="glass-hover rounded-2xl overflow-hidden mb-3">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div
          className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(current.userId)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ring-2 ring-white`}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            @user_{current.userId.slice(0, 6)}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[11px] text-slate-400">{timeAgo(current.createdAt)}</span>
            {current.latitude != null && <MapPin size={9} className="text-slate-300" />}
            <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-[3px] rounded-full ${vis.cls}`}>
              <VisIcon size={9} />
              {vis.label}
            </span>
          </div>
        </div>

        {isOwner && (
          <motion.button
            onClick={handleDelete}
            className="btn-icon w-8 h-8 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50/60 transition-colors"
            whileTap={{ scale: 0.82 }}
            transition={SPRING}
            aria-label="Delete post"
          >
            <Trash2 size={14} />
          </motion.button>
        )}
      </div>

      {/* ── Media ── */}
      {hasMedia && (
        <div className="mt-1">
          <CarouselViewer items={current.postMedia} />
        </div>
      )}

      {/* Caption: text-only post — show before actions */}
      {current.caption && !hasMedia && (
        <p className="px-4 pt-1.5 pb-1 text-sm text-slate-700 leading-relaxed">
          {current.caption}
        </p>
      )}

      {/* ── Action bar ── */}
      <div className="flex items-center gap-0.5 px-3 pt-2 pb-1">
        {/* Heart */}
        <motion.button
          onClick={handleLike}
          disabled={liking}
          className="btn-icon w-9 h-9 rounded-xl"
          whileTap={{ scale: 0.78 }}
          transition={SPRING}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={liked ? 'liked' : 'not-liked'}
              initial={{ scale: liked ? 0.35 : 1.3 }}
              animate={{ scale: 1 }}
              transition={SPRING}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Heart
                size={20}
                className={liked ? 'fill-rose-500 text-rose-500' : 'text-slate-400 hover:text-rose-400'}
              />
            </motion.div>
          </AnimatePresence>
        </motion.button>

        {/* Likes count — slides up/down on change */}
        <div className="overflow-hidden" style={{ minWidth: current.likesCount > 0 ? 20 : 0 }}>
          <AnimatePresence mode="popLayout" initial={false}>
            {current.likesCount > 0 && (
              <motion.span
                key={current.likesCount}
                className="text-xs font-semibold text-slate-600 mr-1 block"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.12 }}
              >
                {current.likesCount.toLocaleString()}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Comments */}
        <motion.button
          onClick={() => setShowComments(true)}
          className="btn-icon w-9 h-9 rounded-xl text-slate-400 hover:text-indigo-500 transition-colors"
          whileTap={{ scale: 0.82 }}
          transition={SPRING}
          aria-label="Comments"
        >
          <MessageCircle size={20} />
        </motion.button>

        {/* Share */}
        <motion.button
          onClick={() => setShowShare(true)}
          className="btn-icon w-9 h-9 rounded-xl text-slate-400 hover:text-indigo-500 transition-colors"
          whileTap={{ scale: 0.82 }}
          transition={SPRING}
          aria-label="Share"
        >
          <Share2 size={20} />
        </motion.button>
      </div>

      {/* Caption: with media — Instagram style below actions */}
      {current.caption && hasMedia && (
        <p className="px-4 pb-4 text-sm text-slate-700 leading-relaxed">
          <span className="font-semibold text-slate-800">@user_{current.userId.slice(0, 6)}</span>{' '}
          {current.caption}
        </p>
      )}

      {/* Bottom spacing for text-only card */}
      {!hasMedia && <div className="pb-2" />}

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
