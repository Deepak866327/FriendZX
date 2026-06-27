import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Lock, MapPin, Users, MessageCircle, UserPlus, Check, Video, X, Camera, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { NearbyUsers } from '@/components/Location/NearbyUsers';
import { CreatePostModal } from '@/components/Posts/CreatePostModal';
import { CommunityFeed } from '@/components/Community/CommunityFeed';
import { RandomCallCard } from '@/components/VideoRoom/RandomCallCard';
import { VideoRoomModal } from '@/components/VideoRoom/VideoRoomModal';
import { MixedFeed } from '@/components/Posts/MixedFeed';
import { StoryBar } from '@/components/Story/StoryBar';
import crationService, { Cration } from '@/services/crationService';
import { CrationPlayerModal } from '@/components/Cration/CrationPlayerModal';
import { ChatModal } from '@/components/Chat/ChatModal';
import { userService } from '@/services/userService';
import postService from '@/services/postService';
import videoRoomService, { VideoRoom } from '@/services/videoRoomService';
import { Community } from '@/services/communityService';
import { PublicProfile } from '@/types/api';
import { overlayVariants, modalVariants, springTransition } from '@/utils/animations';

type FeedTab = 'public' | 'friends' | 'nearby' | 'community';

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

const FEED_TABS: { key: FeedTab; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { key: 'public',    label: 'Public',    Icon: ({ size }) => <Globe size={size} /> },
  { key: 'friends',   label: 'Friends',   Icon: ({ size }) => <Lock size={size} /> },
  { key: 'nearby',    label: 'Nearby',    Icon: ({ size }) => <MapPin size={size} /> },
  { key: 'community', label: 'Community', Icon: ({ size }) => <Users size={size} /> },
];

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { nearbyUsers } = useLocation();
  const navigate = useNavigate();

  const [feedTab,      setFeedTab]      = useState<FeedTab>('public');
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showCreate,   setShowCreate]   = useState(false);

  const [communityPostTarget, setCommunityPostTarget] = useState<Community[] | null>(null);
  const [nearbyRooms,         setNearbyRooms]         = useState<VideoRoom[]>([]);
  const [activeRoom,          setActiveRoom]          = useState<VideoRoom | null>(null);

  const [sidebarProfiles, setSidebarProfiles] = useState<Record<string, PublicProfile>>({});
  const [addedFriends,    setAddedFriends]    = useState<Set<string>>(new Set());
  const [addingId,        setAddingId]        = useState<string | null>(null);
  const [chatTarget,      setChatTarget]      = useState<PublicProfile | null>(null);
  const [nearbyModal,     setNearbyModal]     = useState(false);
  const [selectedCration, setSelectedCration] = useState<Cration | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
    );
  }, []);

  useEffect(() => {
    nearbyUsers.slice(0, 5).forEach(u => {
      if (!sidebarProfiles[u.userId]) {
        userService.getPublicProfile(u.userId)
          .then(p => setSidebarProfiles(prev => ({ ...prev, [u.userId]: p })))
          .catch(() => {});
      }
    });
  }, [nearbyUsers]);

  const handleAddFriend = useCallback(async (userId: string) => {
    setAddingId(userId);
    try {
      await userService.addFriend(userId);
      setAddedFriends(prev => new Set(prev).add(userId));
    } catch (err: any) {
      if (err?.response?.data?.error?.includes('Already following')) {
        setAddedFriends(prev => new Set(prev).add(userId));
      }
    } finally {
      setAddingId(null);
    }
  }, []);

  useEffect(() => {
    if (!userLocation) return;
    videoRoomService.getNearby(userLocation.latitude, userLocation.longitude)
      .then(setNearbyRooms)
      .catch(() => {});
  }, [userLocation, feedTab, refreshKey]);

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'User'
    : 'User';

  const handleJoinRoom = useCallback(async (room: VideoRoom) => { setActiveRoom(room); }, []);

  const publicFetcher  = useCallback((cursor?: string) => postService.getFeed(cursor), []);
  const friendsFetcher = useCallback((cursor?: string) => postService.getFriendsFeed(cursor), []);
  const nearbyFetcher  = useCallback(
    (cursor?: string) => {
      if (!userLocation) return Promise.resolve({ posts: [], nextCursor: null, hasMore: false });
      return postService.getNearbyFeed(userLocation.latitude, userLocation.longitude, 50, cursor);
    },
    [userLocation],
  );

  const publicCrationFetcher  = useCallback((page: number) => crationService.getPublicFeed(page), []);
  const friendsCrationFetcher = useCallback((page: number) => crationService.getFriendsFeed(page), []);
  const nearbyCrationFetcher  = useCallback(
    (page: number) => {
      if (!userLocation) return Promise.resolve({ crations: [], total: 0, page: 1, hasMore: false });
      return crationService.getNearbyFeed(userLocation.latitude, userLocation.longitude, page);
    },
    [userLocation],
  );

  return (
    <div className="pb-28 pt-3">
      <div className="max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex gap-6 items-start">

          {/* ══ FEED COLUMN ══ */}
          <div className="flex-1 min-w-0">

            {/* Greeting */}
            <motion.div
              className="mb-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            >
              <h1 className="text-xl font-bold text-slate-800">
                Hi, <span className="gradient-text">{user?.firstName || displayName}</span> 👋
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">Here's what's happening around you</p>
            </motion.div>

            {/* ── Quick post bar ── */}
            <motion.button
              className="w-full glass rounded-2xl px-4 py-3 flex items-center gap-3 mb-4 text-left"
              onClick={() => setShowCreate(true)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(user?.id ?? 'u')} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
              >
                {user?.firstName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span className="text-sm text-slate-400 flex-1">What's on your mind?</span>
              <div className="flex items-center gap-2.5 text-slate-300">
                <Camera size={16} />
                <Film size={16} />
              </div>
            </motion.button>

            {/* Story bar */}
            <StoryBar refreshKey={refreshKey} userLocation={userLocation} />

            {/* ── Feed tab switcher with sliding indicator ── */}
            <div className="glass rounded-xl p-1 flex gap-1 overflow-x-auto mb-4" style={{ scrollbarWidth: 'none' }}>
              {FEED_TABS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setFeedTab(key)}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors duration-200 z-10"
                  style={{ minHeight: 34, color: feedTab === key ? 'white' : undefined }}
                >
                  {feedTab === key && (
                    <motion.div
                      layoutId="dash-tab-bg"
                      className="absolute inset-0 rounded-lg"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', zIndex: -1 }}
                      transition={springTransition}
                    />
                  )}
                  <span className={feedTab === key ? 'text-white' : 'text-slate-500 hover:text-slate-700'}>
                    <Icon size={12} />
                  </span>
                  <span className={feedTab === key ? 'text-white' : 'text-slate-500 hover:text-slate-700'}>
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {/* Feed content */}
            <AnimatePresence mode="wait">
              {feedTab === 'public' && (
                <motion.div key="public" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <MixedFeed postFetcher={publicFetcher} crationFetcher={publicCrationFetcher} onOpenCration={setSelectedCration} refreshKey={refreshKey} />
                </motion.div>
              )}
              {feedTab === 'friends' && (
                <motion.div key="friends" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <MixedFeed postFetcher={friendsFetcher} crationFetcher={friendsCrationFetcher} onOpenCration={setSelectedCration} refreshKey={refreshKey} />
                </motion.div>
              )}
              {feedTab === 'nearby' && (
                <motion.div key="nearby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  {nearbyRooms.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Video size={14} className="text-indigo-500" />
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Live Calls Nearby</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {nearbyRooms.map(room => (
                          <RandomCallCard key={room.id} room={room} currentUserId={user?.id} onJoin={handleJoinRoom} />
                        ))}
                      </div>
                    </div>
                  )}
                  <MixedFeed postFetcher={nearbyFetcher} crationFetcher={nearbyCrationFetcher} onOpenCration={setSelectedCration} refreshKey={refreshKey} />
                </motion.div>
              )}
              {feedTab === 'community' && (
                <motion.div key="community" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <CommunityFeed onPostInCommunity={communities => setCommunityPostTarget(communities)} userLocation={userLocation} refreshKey={refreshKey} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ══ SIDEBAR — desktop only ══ */}
          {nearbyUsers.length > 0 && (
            <div className="hidden lg:block w-[300px] flex-shrink-0 sticky top-[72px]">
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-700">Suggested for you</h3>
                  <button
                    onClick={() => setNearbyModal(true)}
                    className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                  >
                    See all
                  </button>
                </div>

                <div className="flex flex-col">
                  {nearbyUsers.slice(0, 5).map(u => {
                    const p        = sidebarProfiles[u.userId];
                    const name     = p?.firstName ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : u.userId.slice(0, 10) + '…';
                    const initial  = (p?.firstName || u.userId).charAt(0).toUpperCase();
                    const isFriend = addedFriends.has(u.userId);
                    const isAdding = addingId === u.userId;

                    return (
                      <div key={u.userId} className="flex items-center gap-3 py-3 border-b border-white/40 last:border-0">
                        {/* Avatar with online dot */}
                        <div className="relative flex-shrink-0">
                          {p?.photos?.[0] ? (
                            <img src={p.photos[0]} alt={name} className="w-9 h-9 rounded-full object-cover ring-2 ring-white" />
                          ) : (
                            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(u.userId)} flex items-center justify-center text-white text-sm font-bold ring-2 ring-white`}>
                              {initial}
                            </div>
                          )}
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-[1.5px] ring-white" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                          <p className="text-xs text-slate-400">
                            {u.distance != null ? `${(u.distance / 1000).toFixed(1)} km away` : 'Nearby'}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <motion.button
                            onClick={() => p && setChatTarget(p)}
                            disabled={!p}
                            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-semibold transition-colors disabled:opacity-50"
                            style={{ minHeight: 26, background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.12))', color: '#4f46e5' }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                          >
                            <MessageCircle size={11} /> Chat
                          </motion.button>
                          <motion.button
                            onClick={() => !isFriend && handleAddFriend(u.userId)}
                            disabled={isFriend || isAdding}
                            className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-semibold transition-colors ${
                              isFriend ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            style={{ minHeight: 26 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                          >
                            {isAdding ? '…' : isFriend ? <><Check size={11} /> Friend</> : <><UserPlus size={11} /> Add</>}
                          </motion.button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showCreate && (
        <CreatePostModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setRefreshKey(k => k + 1); setShowCreate(false); }}
          userLocation={userLocation}
        />
      )}

      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}

      {/* Nearby users full modal */}
      <AnimatePresence>
        {nearbyModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setNearbyModal(false)}
          >
            <div className="absolute inset-0 bg-[#0f0a28]/40" />
            <motion.div
              className="glass-strong rounded-3xl w-full max-w-lg flex flex-col overflow-hidden relative z-10"
              style={{ maxHeight: '80vh' }}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/40 flex-shrink-0">
                <span className="font-semibold text-slate-800 flex items-center gap-2">
                  <MapPin size={16} className="text-indigo-500" /> Nearby Users
                </span>
                <button
                  className="btn-icon w-8 h-8 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100/60"
                  onClick={() => setNearbyModal(false)}
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                <NearbyUsers />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {communityPostTarget && (
        <CreatePostModal
          onClose={() => setCommunityPostTarget(null)}
          onCreated={() => { setRefreshKey(k => k + 1); setCommunityPostTarget(null); }}
          userLocation={userLocation}
        />
      )}

      {activeRoom && (
        <VideoRoomModal
          room={activeRoom}
          currentUserId={user?.id ?? ''}
          displayName={displayName}
          onClose={() => { setActiveRoom(null); setRefreshKey(k => k + 1); }}
        />
      )}

      {selectedCration && (
        <CrationPlayerModal cration={selectedCration} onClose={() => setSelectedCration(null)} />
      )}
    </div>
  );
};
