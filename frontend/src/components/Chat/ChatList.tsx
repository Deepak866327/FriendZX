import React, { useEffect, useState, useCallback } from 'react';
import { MessageCircle, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PublicProfile } from '@/types/api';
import { useChatContext } from '@/context/ChatContext';
import { userService } from '@/services/userService';
import { chatService } from '@/services/chatService';
import { formatRelativeTime } from '@/utils/helpers';
import { overlayVariants, modalVariants, staggerListVariants, staggerItemVariants } from '@/utils/animations';

interface ChatListProps {
  onSelectConversation: (profile: PublicProfile) => void;
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

const SPRING = { type: 'spring', damping: 20, stiffness: 400 } as const;

export const ChatList: React.FC<ChatListProps> = ({ onSelectConversation }) => {
  const { conversations, fetchConversations } = useChatContext();
  const [profiles,   setProfiles]   = useState<Record<string, PublicProfile>>({});
  const [isLoading,  setIsLoading]  = useState(true);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [confirmId,  setConfirmId]  = useState<string | null>(null);

  useEffect(() => {
    fetchConversations().finally(() => setIsLoading(false));
  }, [fetchConversations]);

  useEffect(() => {
    const missing = conversations.map(c => c.partnerId).filter(id => !profiles[id]);
    if (missing.length === 0) return;
    Promise.allSettled(missing.map(id => userService.getPublicProfile(id))).then(results => {
      const updates: Record<string, PublicProfile> = {};
      results.forEach((r, i) => { if (r.status === 'fulfilled') updates[missing[i]] = r.value; });
      if (Object.keys(updates).length > 0) setProfiles(prev => ({ ...prev, ...updates }));
    });
  }, [conversations]);

  const getDisplayName = (partnerId: string) => {
    const p = profiles[partnerId];
    if (!p) return partnerId.slice(0, 10) + '…';
    return p.firstName ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : p.userId.slice(0, 10) + '…';
  };

  const handleDelete = useCallback(async (partnerId: string) => {
    setDeleting(partnerId);
    try {
      await chatService.deleteConversation(partnerId);
      await fetchConversations();
    } catch { /* silent */ }
    finally { setDeleting(null); setConfirmId(null); }
  }, [fetchConversations]);

  return (
    <>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-800">Messages</h1>
          <motion.div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.12))' }}
          >
            <MessageCircle size={15} className="text-indigo-500" />
          </motion.div>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass rounded-2xl p-4 flex items-center gap-3">
                <div className="skeleton w-11 h-11 rounded-full flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="skeleton h-3 rounded-full w-2/5" />
                  <div className="skeleton h-2.5 rounded-full w-3/5" />
                </div>
                <div className="skeleton h-2.5 rounded-full w-10" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && conversations.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.12))' }}
            >
              <MessageCircle size={24} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">No conversations yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Find people in Explore and start chatting</p>
            </div>
          </motion.div>
        )}

        {/* Conversation list */}
        {!isLoading && conversations.length > 0 && (
          <motion.div
            className="flex flex-col gap-2"
            variants={staggerListVariants}
            initial="hidden"
            animate="visible"
          >
            {conversations.map(convo => {
              const profile    = profiles[convo.partnerId];
              const isDeleting = deleting === convo.partnerId;
              const name       = getDisplayName(convo.partnerId);
              const initial    = (profile?.firstName || convo.partnerId).charAt(0).toUpperCase();
              const unread     = convo.unreadCount ?? 0;

              return (
                <motion.div
                  key={convo.partnerId}
                  variants={staggerItemVariants}
                  className="glass-hover rounded-2xl p-3.5 flex items-center gap-3"
                  style={{ opacity: isDeleting ? 0.5 : 1 }}
                >
                  {/* Avatar */}
                  <button
                    className="relative flex-shrink-0"
                    onClick={() => profile && onSelectConversation(profile)}
                    disabled={!profile}
                  >
                    <div
                      className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(convo.partnerId)} flex items-center justify-center text-white text-sm font-bold ring-2 ring-white overflow-hidden`}
                    >
                      {profile?.photos?.[0]
                        ? <img src={profile.photos[0]} alt={name} className="w-full h-full object-cover" />
                        : initial
                      }
                    </div>
                    {/* Online dot — no live presence info, so skip */}
                  </button>

                  {/* Content */}
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => profile && onSelectConversation(profile)}
                    disabled={!profile}
                  >
                    <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {convo.lastMessage || 'No messages yet'}
                    </p>
                  </button>

                  {/* Meta */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-slate-400">
                      {formatRelativeTime(new Date(convo.lastMessageTime))}
                    </span>
                    <AnimatePresence>
                      {unread > 0 && (
                        <motion.span
                          className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', damping: 18, stiffness: 400 }}
                        >
                          {unread > 9 ? '9+' : unread}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Delete */}
                  <motion.button
                    onClick={e => { e.stopPropagation(); setConfirmId(convo.partnerId); }}
                    disabled={isDeleting}
                    className="btn-icon w-7 h-7 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50/60 transition-colors ml-1 flex-shrink-0"
                    whileTap={{ scale: 0.85 }}
                    transition={SPRING}
                    aria-label="Delete conversation"
                  >
                    <Trash2 size={13} />
                  </motion.button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      <AnimatePresence>
        {confirmId && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setConfirmId(null)}
          >
            <div className="absolute inset-0 bg-[#0f0a28]/40" />
            <motion.div
              className="glass-strong rounded-3xl w-full max-w-xs p-6 flex flex-col items-center relative z-10"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={e => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 btn-icon w-7 h-7 rounded-xl text-slate-400 hover:text-slate-600"
                onClick={() => setConfirmId(null)}
              >
                <X size={13} />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
                <Trash2 size={20} className="text-rose-500" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1 text-center">Delete conversation?</h3>
              <p className="text-xs text-slate-500 text-center leading-relaxed mb-5">
                This will permanently delete your chat history with{' '}
                <strong>{getDisplayName(confirmId)}</strong>. This cannot be undone.
              </p>
              <div className="flex gap-2 w-full">
                <button className="btn-secondary flex-1 text-sm" onClick={() => setConfirmId(null)}>
                  Cancel
                </button>
                <motion.button
                  className="flex-1 text-sm font-bold py-2.5 px-4 rounded-xl text-white transition-opacity disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}
                  onClick={() => handleDelete(confirmId)}
                  disabled={deleting === confirmId}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING}
                >
                  {deleting === confirmId ? 'Deleting…' : 'Delete'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
