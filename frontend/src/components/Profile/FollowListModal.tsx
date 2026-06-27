import React, { useEffect, useState, useCallback } from 'react';
import { X, MessageCircle, UserPlus, Check, UserMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PublicProfile } from '@/types/api';
import { userService } from '@/services/userService';
import { ChatModal } from '@/components/Chat/ChatModal';
import { overlayVariants, sheetVariants, staggerListVariants, staggerItemVariants } from '@/utils/animations';

interface FollowListModalProps {
  type:    'followers' | 'following';
  onClose: () => void;
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

export const FollowListModal: React.FC<FollowListModalProps> = ({ type, onClose }) => {
  const [open,         setOpen]         = useState(true);
  const [list,         setList]         = useState<PublicProfile[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [addedBackIds, setAddedBackIds] = useState<Set<string>>(new Set());
  const [addingId,     setAddingId]     = useState<string | null>(null);
  const [removingId,   setRemovingId]   = useState<string | null>(null);
  const [removedIds,   setRemovedIds]   = useState<Set<string>>(new Set());
  const [chatTarget,   setChatTarget]   = useState<PublicProfile | null>(null);

  useEffect(() => {
    if (type === 'followers') {
      Promise.all([userService.getFollowers(), userService.getFollowing()])
        .then(([followers, following]) => {
          setList(followers);
          setFollowingSet(new Set(following.map(f => f.userId)));
        })
        .catch(() => setList([]))
        .finally(() => setIsLoading(false));
    } else {
      userService.getFollowing()
        .then(setList)
        .catch(() => setList([]))
        .finally(() => setIsLoading(false));
    }
  }, [type]);

  const handleAddBack = useCallback(async (userId: string) => {
    setAddingId(userId);
    try {
      await userService.addFriend(userId);
      setAddedBackIds(prev => new Set(prev).add(userId));
    } catch (err: any) {
      if (err?.response?.data?.error?.includes('Already following'))
        setAddedBackIds(prev => new Set(prev).add(userId));
    } finally { setAddingId(null); }
  }, []);

  const handleUnfollow = useCallback(async (userId: string) => {
    setRemovingId(userId);
    try {
      await userService.removeFollower(userId);
      setRemovedIds(prev => new Set(prev).add(userId));
    } catch {}
    finally { setRemovingId(null); }
  }, []);

  const handleUnfriend = useCallback(async (userId: string) => {
    setRemovingId(userId);
    try {
      await userService.unfollowUser(userId);
      setRemovedIds(prev => new Set(prev).add(userId));
    } catch {}
    finally { setRemovingId(null); }
  }, []);

  const getDisplayName = (p: PublicProfile) =>
    p.firstName ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : p.userId.slice(0, 10) + '…';

  const title       = type === 'followers' ? 'Followers' : 'Friends';
  const visibleList = list.filter(p => !removedIds.has(p.userId));

  return (
    <>
      <AnimatePresence onExitComplete={onClose}>
        {open && !chatTarget && (
          <motion.div
            className="fixed inset-0 z-50"
            style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setOpen(false)}
          >
            <div className="absolute inset-0 bg-[#0f0a28]/40" />

            <motion.div
              className="absolute bottom-0 left-0 right-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6"
              onClick={e => e.stopPropagation()}
            >
              <motion.div
                className="glass-strong w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden"
                style={{ maxHeight: '85dvh' }}
                variants={sheetVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* Drag handle */}
                <div className="w-10 h-1 rounded-full bg-slate-300/70 mx-auto mt-3 mb-0.5 flex-shrink-0 sm:hidden" />

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/40 flex-shrink-0">
                  <h3 className="text-base font-bold text-slate-800">{title}</h3>
                  <button
                    onClick={() => setOpen(false)}
                    className="btn-icon w-8 h-8 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100/60"
                    aria-label="Close"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'none' }}>
                  {isLoading ? (
                    <div className="flex flex-col gap-2 p-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3 p-1">
                          <div className="skeleton w-11 h-11 rounded-full flex-shrink-0" />
                          <div className="flex-1 flex flex-col gap-2">
                            <div className="skeleton h-3 rounded-full w-2/5" />
                            <div className="skeleton h-2.5 rounded-full w-3/5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : visibleList.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.12))' }}
                      >
                        <span className="text-xl">👥</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No {title.toLowerCase()} yet</p>
                    </div>
                  ) : (
                    <motion.div
                      className="flex flex-col"
                      variants={staggerListVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {visibleList.map(p => {
                        const isRemoving = removingId === p.userId;
                        const isAdding   = addingId === p.userId;
                        const isFriend   = followingSet.has(p.userId) || addedBackIds.has(p.userId);
                        const initial    = (p.firstName || p.userId).charAt(0).toUpperCase();
                        const name       = getDisplayName(p);

                        return (
                          <motion.div
                            key={p.userId}
                            variants={staggerItemVariants}
                            className="flex items-center gap-3 px-4 py-3 border-b border-white/30 last:border-0"
                          >
                            {/* Avatar */}
                            <div
                              className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(p.userId)} flex items-center justify-center text-white text-sm font-bold ring-2 ring-white overflow-hidden flex-shrink-0`}
                            >
                              {p.photos?.[0]
                                ? <img src={p.photos[0]} alt={name} className="w-full h-full object-cover" />
                                : initial}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                              {p.bio && (
                                <p className="text-xs text-slate-400 truncate mt-0.5">{p.bio}</p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {/* Chat */}
                              <motion.button
                                onClick={() => setChatTarget(p)}
                                className="btn-icon w-8 h-8 rounded-xl text-slate-500 hover:text-indigo-500 glass transition-colors"
                                whileTap={{ scale: 0.85 }} transition={SPRING}
                                aria-label="Chat"
                              >
                                <MessageCircle size={14} />
                              </motion.button>

                              {type === 'followers' ? (
                                <>
                                  {/* Remove follower */}
                                  <motion.button
                                    onClick={() => handleUnfollow(p.userId)}
                                    disabled={isRemoving}
                                    className="btn-icon w-8 h-8 rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50/60 glass transition-colors disabled:opacity-50"
                                    whileTap={{ scale: 0.85 }} transition={SPRING}
                                    aria-label="Remove follower"
                                  >
                                    <UserMinus size={14} />
                                  </motion.button>

                                  {/* Add back */}
                                  {isFriend ? (
                                    <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold px-2 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100">
                                      <Check size={11} /> Friend
                                    </div>
                                  ) : (
                                    <motion.button
                                      onClick={() => handleAddBack(p.userId)}
                                      disabled={isAdding}
                                      className="btn-primary text-[11px] px-2.5 h-8 rounded-xl disabled:opacity-50"
                                      whileTap={{ scale: 0.9 }} transition={SPRING}
                                    >
                                      {isAdding ? '…' : <><UserPlus size={11} /> Add</>}
                                    </motion.button>
                                  )}
                                </>
                              ) : (
                                /* Following tab: unfriend */
                                <motion.button
                                  onClick={() => handleUnfriend(p.userId)}
                                  disabled={isRemoving}
                                  className="text-[11px] font-semibold px-2.5 h-8 rounded-xl text-rose-500 bg-rose-50/80 border border-rose-100 hover:bg-rose-100 transition-colors disabled:opacity-50"
                                  whileTap={{ scale: 0.9 }} transition={SPRING}
                                >
                                  {isRemoving ? '…' : 'Unfriend'}
                                </motion.button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}
    </>
  );
};
