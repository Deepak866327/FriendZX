import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Trash2, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Comment } from '@/services/postService';
import { userService } from '@/services/userService';
import { storage } from '@/utils/storage';
import {
  overlayVariants, sheetVariants,
  staggerListVariants, staggerItemVariants,
} from '@/utils/animations';

const COMMENT_OPEN_EVENT = 'freindzx:comment:open';

interface Props {
  parentId: string;
  parentType: 'post' | 'cration';
  commentsCount: number;
  onCountChange?: (delta: number) => void;
  onClose: () => void;
  getComments: (id: string) => Promise<Comment[]>;
  addComment: (id: string, text: string) => Promise<Comment>;
  deleteComment: (parentId: string, commentId: string) => Promise<any>;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

export const CommentsModal: React.FC<Props> = ({
  parentId, parentType, commentsCount, onCountChange, onClose,
  getComments, addComment, deleteComment,
}) => {
  const me = storage.getUser()?.id || '';
  const [comments, setComments]       = useState<Comment[]>([]);
  const [names, setNames]             = useState<Record<string, string>>({});
  const [photos, setPhotos]           = useState<Record<string, string>>({});
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const inputRef  = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.dispatchEvent(new CustomEvent(COMMENT_OPEN_EVENT, { detail: { id: parentId } }));
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id && id !== parentId) onClose();
    };
    document.addEventListener(COMMENT_OPEN_EVENT, handler);
    return () => document.removeEventListener(COMMENT_OPEN_EVENT, handler);
  }, [parentId, onClose]);

  useEffect(() => {
    getComments(parentId)
      .then(data => { setComments(data); fetchProfiles(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [parentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const fetchProfiles = async (list: Comment[]) => {
    const ids = [...new Set(list.map(c => c.userId).filter(id => !names[id]))];
    await Promise.allSettled(ids.map(async id => {
      try {
        const p = await userService.getPublicProfile(id);
        const name = p.firstName ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : id.slice(0, 8);
        setNames(prev => ({ ...prev, [id]: name }));
        if (p.photos?.[0]) setPhotos(prev => ({ ...prev, [id]: p.photos[0] }));
      } catch {}
    }));
  };

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || submitting) return;
    setSubmitting(true); setSubmitError('');
    try {
      const c = await addComment(parentId, text);
      setComments(prev => [...prev, c]);
      onCountChange?.(1);
      setInput('');
      await fetchProfiles([c]);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || err?.message || 'Failed to post comment');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(parentId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      onCountChange?.(-1);
    } catch {}
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        style={{ background: 'rgba(15,10,40,0.50)', backdropFilter: 'blur(4px)' }}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      >
        <motion.div
          className="glass-strong rounded-t-3xl w-full flex flex-col"
          style={{ maxHeight: '82vh' }}
          variants={sheetVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-300/70" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/30">
            <button className="btn-icon text-slate-500" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
            <span className="text-sm font-semibold text-slate-800">
              Comments
              {comments.length > 0 && (
                <span className="text-slate-400 font-normal ml-1.5">({comments.length})</span>
              )}
            </span>
            {/* spacer to centre title */}
            <div className="w-9" />
          </div>

          {/* Comment list */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-1">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-400">
                <MessageCircle size={36} className="opacity-40" />
                <p className="text-sm font-medium">No comments yet. Be the first!</p>
              </div>
            ) : (
              <motion.div
                variants={staggerListVariants}
                initial="hidden"
                animate="visible"
                className="space-y-1"
              >
                {comments.map(c => {
                  const name  = names[c.userId]  || c.userId.slice(0, 8) + '…';
                  const photo = photos[c.userId];
                  const isOwn = c.userId === me;
                  return (
                    <motion.div
                      key={c.id}
                      variants={staggerItemVariants}
                      className="flex items-start gap-3 p-3 rounded-2xl hover:bg-white/30 transition-colors group"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold ring-2 ring-white/60">
                        {photo
                          ? <img src={photo} alt="" className="w-full h-full object-cover" />
                          : name.charAt(0).toUpperCase()
                        }
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-800">{name}</span>
                          <span className="text-[11px] text-slate-400">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-700 leading-relaxed break-words">{c.text}</p>
                      </div>

                      {/* Delete (own comments only) */}
                      {isOwn && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50"
                          aria-label="Delete comment"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </motion.div>
                  );
                })}
                <div ref={bottomRef} />
              </motion.div>
            )}
          </div>

          {/* Input row */}
          <div className="border-t border-white/30 px-4 py-3 pb-safe">
            {submitError && (
              <p className="text-xs text-rose-500 mb-2 px-1">{submitError}</p>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                placeholder="Add a comment…"
                className="input-glass flex-1 text-sm"
                style={{ borderRadius: '1rem' }}
                autoFocus
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || submitting}
                className="btn-icon disabled:opacity-40"
                style={{
                  background: input.trim() ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : undefined,
                  color: input.trim() ? 'white' : undefined,
                }}
                aria-label="Post comment"
              >
                {submitting
                  ? <span className="w-4 h-4 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
                  : <Send size={16} />
                }
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
