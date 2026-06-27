import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, LayoutGrid, Film, MessageCircle, UserPlus, UserCheck, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PublicProfile } from '@/types/api';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import postService, { Post, FeedPage } from '@/services/postService';
import crationService, { Cration } from '@/services/crationService';
import { PostCard } from '@/components/Posts/PostCard';
import { SkeletonCard } from '@/components/Posts/SkeletonCard';
import { CrationCard } from '@/components/Cration/CrationCard';
import { CrationPlayerModal } from '@/components/Cration/CrationPlayerModal';
import { ChatModal } from '@/components/Chat/ChatModal';
import { overlayVariants, sheetVariants, staggerListVariants, staggerItemVariants, springTransition } from '@/utils/animations';

type Tab = 'posts' | 'crations';

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

interface Props {
  userId:  string;
  onClose: () => void;
}

export const UserProfileModal: React.FC<Props> = ({ userId, onClose }) => {
  const { user: me } = useAuth();
  const [open,          setOpen]          = useState(true);
  const [profile,       setProfile]       = useState<PublicProfile | null>(null);
  const [loadingP,      setLoadingP]      = useState(true);
  const [tab,           setTab]           = useState<Tab>('posts');
  const [isFollowing,   setIsFollowing]   = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [posts,       setPosts]       = useState<Post[]>([]);
  const [postCursor,  setPostCursor]  = useState<string | undefined>();
  const [postMore,    setPostMore]    = useState(true);
  const [postLoading, setPostLoading] = useState(false);
  const postLoadingRef = useRef(false);

  const [crations,      setCrations]      = useState<Cration[]>([]);
  const [crationPage,   setCrationPage]   = useState(1);
  const [crationMore,   setCrationMore]   = useState(true);
  const [crationLoad,   setCrationLoad]   = useState(false);
  const [activeCration, setActiveCration] = useState<Cration | null>(null);
  const [chatTarget,    setChatTarget]    = useState<PublicProfile | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleClose = () => setOpen(false);

  useEffect(() => {
    setLoadingP(true);
    Promise.all([
      userService.getPublicProfile(userId),
      me?.id ? userService.getRelationship?.(userId).catch(() => null) : Promise.resolve(null),
    ]).then(([prof, rel]) => {
      setProfile(prof);
      if (rel) setIsFollowing(rel.isFollowing ?? false);
    }).catch(() => {}).finally(() => setLoadingP(false));
  }, [userId]);

  const loadPosts = useCallback(async (reset = false) => {
    if (postLoadingRef.current) return;
    postLoadingRef.current = true;
    setPostLoading(true);
    try {
      const cursor = reset ? undefined : postCursor;
      const page: FeedPage = await postService.getUserPosts(userId, cursor);
      setPosts(prev => reset ? page.posts : [...prev, ...page.posts]);
      setPostCursor(page.nextCursor ?? undefined);
      setPostMore(page.hasMore);
    } catch {}
    setPostLoading(false);
    postLoadingRef.current = false;
  }, [userId, postCursor]);

  const loadCrations = useCallback(async (page: number, reset = false) => {
    setCrationLoad(true);
    try {
      const res = await crationService.getUserCrations(userId, page);
      setCrations(prev => reset ? res.crations : [...prev, ...res.crations]);
      setCrationMore(res.hasMore);
      setCrationPage(page);
    } catch {}
    setCrationLoad(false);
  }, [userId]);

  useEffect(() => {
    if (tab === 'posts'    && posts.length === 0)    loadPosts(true);
    if (tab === 'crations' && crations.length === 0) loadCrations(1, true);
  }, [tab]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || tab !== 'posts') return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting && postMore && !postLoading) loadPosts(); },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, postMore, postLoading, loadPosts]);

  const toggleFollow = async () => {
    if (!me || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await userService.unfollowUser(userId);
        setIsFollowing(false);
        setProfile(prev => prev ? { ...prev, followers: Math.max(0, (prev.followers ?? 0) - 1) } : prev);
      } else {
        await userService.addFriend(userId);
        setIsFollowing(true);
        setProfile(prev => prev ? { ...prev, followers: (prev.followers ?? 0) + 1 } : prev);
      }
    } catch {}
    setFollowLoading(false);
  };

  const initial     = profile ? (profile.firstName || profile.userId).charAt(0).toUpperCase() : '?';
  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username || `User ${userId.slice(0, 6)}`
    : '…';

  const TABS: { key: Tab; label: string; Icon: React.FC<{ size?: number }> }[] = [
    { key: 'posts',    label: 'Posts',     Icon: ({ size }) => <LayoutGrid size={size} /> },
    { key: 'crations', label: 'Creations', Icon: ({ size }) => <Film size={size} /> },
  ];

  return (
    <>
      <AnimatePresence onExitComplete={onClose}>
        {open && (
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
            style={{ background: 'rgba(15,10,40,0.50)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            onClick={handleClose}
          >
            <motion.div
              variants={sheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="glass-strong w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Top bar */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/40 flex-shrink-0">
                <span style={{ width: 32 }} />
                <span className="text-sm font-bold text-slate-800">Profile</span>
                <button
                  onClick={handleClose}
                  className="btn-icon w-8 h-8 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100/60"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 scrollbar-none">
                {loadingP ? (
                  <div className="flex items-center justify-center py-20">
                    <span className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Profile header */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: 0.08 }}
                      className="px-6 pt-6 pb-4 flex items-start gap-5"
                    >
                      <div className="flex-shrink-0 relative" style={{ width: 72, height: 72 }}>
                        <div
                          className="absolute -inset-[2.5px] rounded-full"
                          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#38bdf8)' }}
                        />
                        <div
                          className={`relative w-full h-full rounded-full overflow-hidden border-[3px] border-white ${!profile?.photos?.[0] ? `bg-gradient-to-br ${avatarGradient(userId)} flex items-center justify-center text-white text-2xl font-bold` : ''}`}
                        >
                          {profile?.photos?.[0]
                            ? <img src={profile.photos[0]} alt="" className="w-full h-full object-cover" />
                            : initial}
                        </div>
                      </div>

                      <div className="flex flex-1 justify-around">
                        {[
                          { value: profile?.followers ?? 0, label: 'Followers' },
                          { value: profile?.following ?? 0, label: 'Following' },
                          { value: posts.length > 0 ? `${posts.length}${postMore ? '+' : ''}` : '—', label: 'Posts' },
                        ].map(s => (
                          <div key={s.label} className="text-center">
                            <p className="text-lg font-bold gradient-text">{s.value}</p>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Bio */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: 0.14 }}
                      className="px-6 pb-4"
                    >
                      <p className="text-sm font-bold text-slate-800">{displayName}</p>
                      {profile?.username && (
                        <p className="text-xs text-slate-400 mt-0.5">@{profile.username}</p>
                      )}
                      {profile?.bio && (
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{profile.bio}</p>
                      )}
                      {profile?.interests && profile.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {profile.interests.slice(0, 6).map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>

                    {/* Actions */}
                    {me?.id !== userId && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: 0.20 }}
                        className="px-6 pb-4 flex gap-2"
                      >
                        <motion.button
                          onClick={toggleFollow}
                          disabled={followLoading}
                          className={`flex-1 disabled:opacity-60 ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ minHeight: 40 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          {followLoading ? (
                            <span className="flex items-center gap-2 justify-center">
                              <span className="w-3.5 h-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                              …
                            </span>
                          ) : isFollowing ? (
                            <><UserCheck size={15} /> Following</>
                          ) : (
                            <><UserPlus size={15} /> Follow</>
                          )}
                        </motion.button>
                        <motion.button
                          onClick={() => profile && setChatTarget(profile)}
                          className="btn-secondary flex-1"
                          style={{ minHeight: 40 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <MessageCircle size={15} /> Message
                        </motion.button>
                      </motion.div>
                    )}

                    {/* Divider + tabs */}
                    <div className="mx-6 border-t border-white/40" />
                    <div className="px-4 pt-3 pb-0">
                      <div className="glass rounded-xl p-1 flex gap-1">
                        {TABS.map(({ key, label, Icon }) => (
                          <button
                            key={key}
                            onClick={() => setTab(key)}
                            className="relative flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold z-10 transition-colors duration-200"
                            style={{ minHeight: 34, color: tab === key ? 'white' : undefined }}
                          >
                            {tab === key && (
                              <motion.div
                                layoutId="upm-tab-bg"
                                className="absolute inset-0 rounded-lg"
                                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', zIndex: -1 }}
                                transition={springTransition}
                              />
                            )}
                            <span className={tab === key ? 'text-white' : 'text-slate-500'}>
                              <Icon size={12} />
                            </span>
                            <span className={tab === key ? 'text-white' : 'text-slate-500'}>
                              {label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="px-4 pt-3 pb-6">

                      {tab === 'posts' && (
                        <div>
                          {posts.length === 0 && !postLoading ? (
                            <div className="glass rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
                              <div className="w-12 h-12 rounded-2xl bg-white/60 flex items-center justify-center">
                                <Image size={22} className="text-indigo-300" />
                              </div>
                              <p className="text-sm font-semibold text-slate-700">No posts yet</p>
                            </div>
                          ) : (
                            <>
                              <motion.div
                                variants={staggerListVariants}
                                initial="hidden"
                                animate="visible"
                              >
                                {posts.map(post => (
                                  <motion.div key={post.id} variants={staggerItemVariants}>
                                    <PostCard post={post} />
                                  </motion.div>
                                ))}
                              </motion.div>
                              {postLoading && <><SkeletonCard /><SkeletonCard /></>}
                              {!postLoading && postMore && <div ref={sentinelRef} style={{ height: 1 }} />}
                              {!postMore && posts.length > 0 && (
                                <p className="text-center text-xs text-slate-400 py-3">All posts loaded</p>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {tab === 'crations' && (
                        <div>
                          {crations.length === 0 && !crationLoad ? (
                            <div className="glass rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
                              <div className="w-12 h-12 rounded-2xl bg-white/60 flex items-center justify-center">
                                <Film size={22} className="text-indigo-300" />
                              </div>
                              <p className="text-sm font-semibold text-slate-700">No creations yet</p>
                            </div>
                          ) : (
                            <>
                              <motion.div
                                className="grid grid-cols-2 gap-3"
                                variants={staggerListVariants}
                                initial="hidden"
                                animate="visible"
                              >
                                {crations.map(c => (
                                  <motion.div key={c.id} variants={staggerItemVariants}>
                                    <CrationCard
                                      cration={c}
                                      onClick={() => setActiveCration(c)}
                                    />
                                  </motion.div>
                                ))}
                              </motion.div>
                              {crationLoad && (
                                <div className="flex justify-center py-4">
                                  <span className="w-6 h-6 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
                                </div>
                              )}
                              {!crationLoad && crationMore && (
                                <div className="text-center mt-3">
                                  <button
                                    onClick={() => loadCrations(crationPage + 1)}
                                    className="btn-secondary text-xs px-5"
                                    style={{ minHeight: 36 }}
                                  >
                                    Load more
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}

                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeCration && (
        <CrationPlayerModal cration={activeCration} onClose={() => setActiveCration(null)} />
      )}
      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}
    </>
  );
};
