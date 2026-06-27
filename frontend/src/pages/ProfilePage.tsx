import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Settings, MapPin, LayoutGrid, Film, Pen, Camera, Video, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { ProfileEditor } from '@/components/Profile/ProfileEditor';
import { FollowListModal } from '@/components/Profile/FollowListModal';
import { SettingsModal } from '@/components/Profile/SettingsModal';
import { Loading } from '@/components/Common/Loading';
import { CreatePostModal } from '@/components/Posts/CreatePostModal';
import { PostFeed } from '@/components/Posts/PostFeed';
import { CrationCard } from '@/components/Cration/CrationCard';
import { CreateCrationModal } from '@/components/Cration/CreateCrationModal';
import { userService } from '@/services/userService';
import postService from '@/services/postService';
import crationService, { Cration } from '@/services/crationService';
import communityService from '@/services/communityService';
import { pageVariants, overlayVariants, springTransition } from '@/utils/animations';

type ProfileTab = 'posts' | 'cration' | 'edit';

const GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-purple-600',
  'from-sky-400 to-blue-500',
  'from-pink-500 to-rose-500',
];

const SPRING = { type: 'spring', damping: 20, stiffness: 400 } as const;

const TABS: { key: ProfileTab; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { key: 'posts',   label: 'Posts',     Icon: ({ size }) => <LayoutGrid size={size} /> },
  { key: 'cration', label: 'Creations', Icon: ({ size }) => <Film size={size} /> },
  { key: 'edit',    label: 'Edit',      Icon: ({ size }) => <Pen size={size} /> },
];

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { profile, isLoading, fetchProfile } = useUser();

  const [activeTab,         setActiveTab]         = useState<ProfileTab>('posts');
  const [followModal,       setFollowModal]       = useState<'followers' | 'following' | null>(null);
  const [showSettings,      setShowSettings]      = useState(false);
  const [showCreate,        setShowCreate]        = useState(false);
  const [postRefreshKey,    setPostRefreshKey]    = useState(0);
  const [showCreateCration, setShowCreateCration] = useState(false);
  const [crations,          setCrations]          = useState<Cration[]>([]);
  const [crationPage,       setCrationPage]       = useState(1);
  const [crationHasMore,    setCrationHasMore]    = useState(true);
  const [crationLoading,    setCrationLoading]    = useState(false);
  const [activeCration,     setActiveCration]     = useState<Cration | null>(null);
  const [uploading,         setUploading]         = useState(false);
  const [communityCount,    setCommunityCount]    = useState(0);
  const [postCount,         setPostCount]         = useState(0);
  const [userLocation,      setUserLocation]      = useState<{ latitude: number; longitude: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
    communityService.getMine().then(c => setCommunityCount(c.length)).catch(() => {});
    if (user?.id) {
      postService.getUserPosts(user.id, undefined, 1).then(r => setPostCount(r.posts.length)).catch(() => {});
    }
    navigator.geolocation?.getCurrentPosition(
      pos => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
    );
  }, [fetchProfile]);

  const myPostsFetcher = useCallback(
    (cursor?: string) => {
      if (!user?.id) return Promise.resolve({ posts: [], nextCursor: null, hasMore: false });
      return postService.getUserPosts(user.id, cursor);
    },
    [user?.id],
  );

  const loadCrations = useCallback(async (page: number, reset = false) => {
    if (!user?.id) return;
    setCrationLoading(true);
    try {
      const res = await crationService.getUserCrations(user.id, page);
      setCrations(prev => reset ? res.crations : [...prev, ...res.crations]);
      setCrationHasMore(res.hasMore);
      setCrationPage(page);
    } catch {}
    finally { setCrationLoading(false); }
  }, [user?.id]);

  const handleDeleteCration = useCallback(async (id: string) => {
    try {
      await crationService.remove(id);
      setCrations(prev => prev.filter(c => c.id !== id));
    } catch (err: any) { alert(err?.response?.data?.error || 'Failed to delete'); }
  }, []);

  useEffect(() => {
    if (activeTab === 'cration' && crations.length === 0) loadCrations(1, true);
  }, [activeTab]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await userService.uploadPhoto(file); await fetchProfile(); }
    catch {}
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  if (isLoading) return <Loading message="Loading profile…" />;

  const initial  = user?.firstName?.charAt(0)?.toUpperCase() || '?';
  const gradIdx  = (user?.id?.charCodeAt(0) ?? 0) % GRADIENTS.length;

  const STATS = [
    { value: postCount,                       label: 'Posts',       onClick: () => setActiveTab('posts') },
    { value: (profile as any)?.friends ?? 0,  label: 'Friends',    onClick: () => setFollowModal('following') },
    { value: profile?.followers ?? 0,         label: 'Followers',  onClick: () => setFollowModal('followers') },
    { value: communityCount,                  label: 'Communities', onClick: undefined },
  ];

  return (
    <motion.div
      className="pb-28 pt-3"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* ── Profile header card ── */}
        <div className="glass rounded-3xl p-6 sm:p-8 mb-4">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">

            {/* Avatar */}
            <div className="flex-shrink-0">
              <div
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                style={{ width: 88, height: 88 }}
              >
                <div
                  className="absolute -inset-[3px] rounded-full"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#38bdf8)' }}
                />
                <div
                  className={`relative w-full h-full rounded-full overflow-hidden border-[3px] border-white ${
                    !profile?.photos?.[0] ? `bg-gradient-to-br ${GRADIENTS[gradIdx]} flex items-center justify-center text-white text-3xl font-bold` : ''
                  }`}
                >
                  {profile?.photos?.[0]
                    ? <img src={profile.photos[0]} alt="Profile" className="w-full h-full object-cover" />
                    : initial}
                </div>
                <div
                  className={`absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center gap-0.5 transition-opacity duration-200 ${
                    uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {uploading
                    ? <span className="text-white text-[10px] font-semibold">Uploading…</span>
                    : <><Camera size={18} className="text-white" /><span className="text-white text-[9px] font-semibold">Change</span></>
                  }
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-4">
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-slate-800">
                    {user?.firstName} {user?.lastName}
                  </h1>
                  {user?.username && (
                    <p className="text-sm text-slate-400 mt-0.5">@{user.username}</p>
                  )}
                </div>
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-shrink-0 flex-wrap">
                  <motion.button
                    onClick={() => setActiveTab('edit')}
                    className="btn-secondary text-xs px-3"
                    style={{ minHeight: 34 }}
                    whileTap={{ scale: 0.96 }} transition={SPRING}
                  >
                    Edit Profile
                  </motion.button>
                  <motion.button
                    onClick={() => setShowCreate(true)}
                    className="btn-primary text-xs px-3"
                    style={{ minHeight: 34 }}
                    whileTap={{ scale: 0.96 }} transition={SPRING}
                  >
                    <Plus size={13} /> Post
                  </motion.button>
                  <motion.button
                    onClick={() => setShowSettings(true)}
                    className="btn-icon w-[34px] h-[34px] rounded-lg glass text-slate-500 hover:text-indigo-600"
                    aria-label="Settings"
                    whileTap={{ scale: 0.88 }} transition={SPRING}
                  >
                    <Settings size={15} />
                  </motion.button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {STATS.map(s => (
                  <motion.button
                    key={s.label}
                    onClick={s.onClick}
                    disabled={!s.onClick}
                    className={`glass rounded-xl py-2.5 text-center transition-all ${s.onClick ? 'hover:bg-white/80 cursor-pointer' : 'cursor-default'}`}
                    whileTap={s.onClick ? { scale: 0.96 } : undefined}
                    transition={SPRING}
                  >
                    <p className="text-base font-bold gradient-text">{s.value}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{s.label}</p>
                  </motion.button>
                ))}
              </div>

              {profile?.bio && (
                <p className="text-sm text-slate-600 leading-relaxed mb-2">{profile.bio}</p>
              )}
              {profile?.location && (
                <p className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1 mb-2">
                  <MapPin size={11} className="text-indigo-400" />{profile.location}
                </p>
              )}
              {profile?.interests && profile.interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                  {profile.interests.map((tag, i) => (
                    <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tab bar with sliding indicator ── */}
        <div className="glass rounded-xl p-1 flex gap-1 mb-4">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="relative flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold z-10 transition-colors duration-200"
              style={{ minHeight: 36, color: activeTab === key ? 'white' : undefined }}
            >
              {activeTab === key && (
                <motion.div
                  layoutId="profile-tab-bg"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', zIndex: -1 }}
                  transition={springTransition}
                />
              )}
              <span className={activeTab === key ? 'text-white' : 'text-slate-500'}>
                <Icon size={13} />
              </span>
              <span className={activeTab === key ? 'text-white' : 'text-slate-500'}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* ── Tab content with AnimatePresence ── */}
        <AnimatePresence mode="wait">
          {activeTab === 'posts' && (
            <motion.div key="posts" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <PostFeed fetcher={myPostsFetcher} refreshKey={postRefreshKey} emptyText="No posts yet — share something!" />
            </motion.div>
          )}

          {activeTab === 'cration' && (
            <motion.div key="cration" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700">My Creations</h2>
                <motion.button
                  onClick={() => setShowCreateCration(true)}
                  className="btn-primary text-xs px-3"
                  style={{ minHeight: 34 }}
                  whileTap={{ scale: 0.96 }} transition={SPRING}
                >
                  <Video size={13} /> New Creation
                </motion.button>
              </div>

              {crationLoading && crations.length === 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[1, 2, 3, 4].map(i => <div key={i} className="skeleton rounded-2xl aspect-[3/4]" />)}
                </div>
              ) : crations.length === 0 ? (
                <div className="glass rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.12))' }}
                  >
                    <Film size={26} className="text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 mb-1">No creations yet</p>
                    <p className="text-sm text-slate-400">Share your first video with the world!</p>
                  </div>
                  <motion.button
                    onClick={() => setShowCreateCration(true)}
                    className="btn-primary text-sm px-5 mt-1"
                    whileTap={{ scale: 0.96 }} transition={SPRING}
                  >
                    <Video size={15} /> Create Now
                  </motion.button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {crations.map(c => (
                      <CrationCard key={c.id} cration={c} onClick={() => setActiveCration(c)} onDelete={handleDeleteCration} />
                    ))}
                  </div>
                  {crationHasMore && (
                    <div className="text-center mt-4">
                      <motion.button
                        onClick={() => loadCrations(crationPage + 1)}
                        disabled={crationLoading}
                        className="btn-secondary text-xs px-5"
                        style={{ minHeight: 36 }}
                        whileTap={{ scale: 0.96 }} transition={SPRING}
                      >
                        {crationLoading ? 'Loading…' : 'Load More'}
                      </motion.button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'edit' && (
            <motion.div key="edit" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <ProfileEditor />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Cration viewer overlay ── */}
      <AnimatePresence>
        {activeCration && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setActiveCration(null)}
          >
            <div className="absolute inset-0 bg-black/80" />
            <motion.div
              className="relative w-full max-w-sm rounded-3xl overflow-hidden bg-black z-10"
              initial={{ scale: 0.94, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 20, opacity: 0 }}
              transition={springTransition}
              onClick={e => e.stopPropagation()}
            >
              <button
                className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                onClick={() => setActiveCration(null)}
              >
                <X size={15} />
              </button>
              <video
                src={activeCration.videoUrl.startsWith('http')
                  ? activeCration.videoUrl
                  : `/api/crations/uploads/${activeCration.videoUrl.split('/').pop()}`}
                controls
                autoPlay
                className="w-full max-h-[70vh] block"
              />
              {activeCration.caption && (
                <p className="px-4 py-3 text-white text-sm">{activeCration.caption}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      {showCreate && (
        <CreatePostModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setPostRefreshKey(k => k + 1); setPostCount(c => c + 1); }}
          userLocation={userLocation}
        />
      )}
      {showCreateCration && (
        <CreateCrationModal
          onClose={() => setShowCreateCration(false)}
          onCreated={() => { setShowCreateCration(false); loadCrations(1, true); }}
        />
      )}
      {followModal && (
        <FollowListModal type={followModal} onClose={() => setFollowModal(null)} />
      )}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </motion.div>
  );
};
