import React, { useState, useCallback, useEffect } from 'react';
import { Globe, Users, MapPin, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PostFeed } from '@/components/Posts/PostFeed';
import { CreatePostModal } from '@/components/Posts/CreatePostModal';
import postService, { Post } from '@/services/postService';

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
    <div className="py-4 pb-24">
      <div className="max-w-[680px] mx-auto px-4 sm:px-6">

        {/* ── Tab bar + New Post button ── */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="glass rounded-xl p-1 flex gap-1 flex-1">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  mode === key
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
                style={{ minHeight: 36 }}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-xs px-3 flex-shrink-0"
            style={{ minHeight: 36 }}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New Post</span>
          </button>
        </div>

        {/* ── Feed ── */}
        <PostFeed
          fetcher={activeFetcher}
          refreshKey={refreshKey * 10 + ['public', 'friends', 'nearby'].indexOf(mode)}
          emptyText={
            mode === 'nearby'  ? 'No nearby posts found' :
            mode === 'friends' ? 'No posts from friends yet' :
                                 'No posts yet — be the first!'
          }
        />
      </div>

      {showCreate && (
        <CreatePostModal
          onClose={() => setShowCreate(false)}
          onCreated={(_post: Post) => setRefreshKey(k => k + 1)}
          userLocation={location}
        />
      )}
    </div>
  );
};
