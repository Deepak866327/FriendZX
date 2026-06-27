import React, { useState, useCallback, useEffect } from 'react';
import { Globe, Users, MapPin, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { PostFeed } from '@/components/Posts/PostFeed';
import { CreatePostModal } from '@/components/Posts/CreatePostModal';
import postService, { Post } from '@/services/postService';
import { pageVariants, springTransition } from '@/utils/animations';

type FeedMode = 'public' | 'friends' | 'nearby';

const TABS: { key: FeedMode; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { key: 'public',  label: 'Everyone', Icon: ({ size }) => <Globe size={size} /> },
  { key: 'friends', label: 'Friends',  Icon: ({ size }) => <Users size={size} /> },
  { key: 'nearby',  label: 'Nearby',   Icon: ({ size }) => <MapPin size={size} /> },
];

export const FeedPage: React.FC = () => {
  const { user } = useAuth();
  const [mode,       setMode]       = useState<FeedMode>('public');
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [location,   setLocation]   = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => setLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => {},
    );
  }, []);

  const publicFetcher  = useCallback((cursor?: string, limit?: number) => postService.getFeed(cursor, limit), []);
  const friendsFetcher = useCallback((cursor?: string, limit?: number) => postService.getFriendsFeed(cursor, limit), []);
  const nearbyFetcher  = useCallback(
    (cursor?: string, limit?: number) =>
      location
        ? postService.getNearbyFeed(location.latitude, location.longitude, 50, cursor, limit)
        : Promise.resolve({ posts: [], nextCursor: null, hasMore: false }),
    [location],
  );

  const activeFetcher =
    mode === 'friends' ? friendsFetcher :
    mode === 'nearby'  ? nearbyFetcher  :
    publicFetcher;

  return (
    <motion.div
      className="py-4 pb-28"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="max-w-[680px] mx-auto px-4 sm:px-6">

        {/* ── Tab bar + New Post button ── */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="glass rounded-xl p-1 flex gap-1 flex-1">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className="relative flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold z-10 transition-colors duration-200"
                style={{ minHeight: 36, color: mode === key ? 'white' : undefined }}
              >
                {mode === key && (
                  <motion.div
                    layoutId="feed-tab-bg"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', zIndex: -1 }}
                    transition={springTransition}
                  />
                )}
                <span className={mode === key ? 'text-white' : 'text-slate-500 hover:text-slate-700'}>
                  <Icon size={13} />
                </span>
                <span className={`hidden sm:inline ${mode === key ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          <motion.button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-xs px-3 flex-shrink-0"
            style={{ minHeight: 36 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New Post</span>
          </motion.button>
        </div>

        {/* ── Feed (fades on tab change) ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          >
            <PostFeed
              fetcher={activeFetcher}
              refreshKey={refreshKey * 10 + ['public', 'friends', 'nearby'].indexOf(mode)}
              emptyText={
                mode === 'nearby'  ? 'No nearby posts found' :
                mode === 'friends' ? 'No posts from friends yet' :
                                     'No posts yet — be the first!'
              }
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {showCreate && (
        <CreatePostModal
          onClose={() => setShowCreate(false)}
          onCreated={(_post: Post) => setRefreshKey(k => k + 1)}
          userLocation={location}
        />
      )}
    </motion.div>
  );
};
