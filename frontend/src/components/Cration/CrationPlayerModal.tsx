import React, { useRef, useEffect, useState } from 'react';
import { X, Heart, MessageCircle, Share2, Eye, Trash2, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import crationService, { Cration } from '@/services/crationService';
import { useAuth } from '@/hooks/useAuth';
import { CommentsModal } from '@/components/Common/CommentsModal';
import { ShareSheet } from '@/components/Common/ShareSheet';
import { Comment } from '@/services/postService';
import { overlayVariants } from '@/utils/animations';

const SPRING = { type: 'spring', damping: 20, stiffness: 400 } as const;

interface Props {
  cration: Cration;
  onClose: () => void;
}

export const CrationPlayerModal: React.FC<Props> = ({ cration: initial, onClose }) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(true);
  const [muted, setMuted] = useState(false);
  const [cration, setCration] = useState(initial);
  const [commentsCount, setCommentsCount] = useState(initial.commentsCount ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);

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
    try { await crationService.remove(cration.id); setOpen(false); } catch {}
  };

  return (
    <>
      <AnimatePresence onExitComplete={onClose}>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black flex flex-col"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div
              className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-4 pb-6"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}
            >
              <motion.button
                className="btn-icon w-9 h-9 rounded-xl text-white/80 hover:text-white"
                onClick={() => setOpen(false)}
                whileTap={{ scale: 0.85 }}
                transition={SPRING}
              >
                <X size={18} />
              </motion.button>
              <span className="text-sm font-bold text-white">Cration</span>
              <div className="w-9" />
            </div>

            {/* Video */}
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain"
              loop playsInline muted={muted} autoPlay
            />

            {/* Mute toggle */}
            <motion.button
              className="absolute top-16 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
              onClick={() => setMuted(m => !m)}
              whileTap={{ scale: 0.85 }}
              transition={SPRING}
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </motion.button>

            {/* Right action column */}
            <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5">
              {/* Like */}
              <div className="flex flex-col items-center gap-1">
                <motion.button
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
                  onClick={handleLike}
                  whileTap={{ scale: 0.8 }}
                  transition={SPRING}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={liked ? 'liked' : 'not-liked'}
                      initial={{ scale: liked ? 0.35 : 1.3 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={SPRING}
                    >
                      <Heart size={22} className={liked ? 'fill-rose-500 text-rose-500' : 'text-white'} />
                    </motion.div>
                  </AnimatePresence>
                </motion.button>
                <span className="text-xs text-white/80 font-semibold">{cration.likesCount}</span>
              </div>

              {/* Comment */}
              <div className="flex flex-col items-center gap-1">
                <motion.button
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
                  onClick={() => setShowComments(true)}
                  whileTap={{ scale: 0.85 }}
                  transition={SPRING}
                >
                  <MessageCircle size={20} className="text-white" />
                </motion.button>
                <span className="text-xs text-white/80 font-semibold">{commentsCount}</span>
              </div>

              {/* Share */}
              <motion.button
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
                onClick={() => setShowShare(true)}
                whileTap={{ scale: 0.85 }}
                transition={SPRING}
              >
                <Share2 size={20} className="text-white" />
              </motion.button>

              {/* Views */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
                >
                  <Eye size={20} className="text-white/60" />
                </div>
                <span className="text-xs text-white/60 font-semibold">{cration.views}</span>
              </div>

              {/* Delete */}
              {isOwner && (
                <motion.button
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(220,38,38,0.3)', backdropFilter: 'blur(8px)' }}
                  onClick={handleDelete}
                  whileTap={{ scale: 0.85 }}
                  transition={SPRING}
                >
                  <Trash2 size={18} className="text-rose-300" />
                </motion.button>
              )}
            </div>

            {/* Bottom info */}
            <div
              className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-16 pr-20"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}
            >
              <p className="text-sm font-bold text-white mb-1">@user_{cration.userId.slice(0, 6)}</p>
              {cration.caption && (
                <p className="text-sm text-white/80 line-clamp-3">{cration.caption}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          onShare={() => { crationService.trackShare(cration.id); }}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
};
