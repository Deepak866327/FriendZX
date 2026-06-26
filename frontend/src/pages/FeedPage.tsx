import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PostFeed } from '@/components/Posts/PostFeed';
import { CreatePostModal } from '@/components/Posts/CreatePostModal';
import postService, { Post } from '@/services/postService';

type FeedMode = 'public' | 'friends' | 'nearby';

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
    <div className="feed-page">
      <div className="feed-page__header">
        <div className="feed-page__tabs">
          {(['public', 'friends', 'nearby'] as FeedMode[]).map(m => (
            <button
              key={m}
              className={`feed-page__tab${mode === m ? ' feed-page__tab--active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'public'  ? '🌍 Everyone' :
               m === 'friends' ? '👥 Friends'  :
                                 '📍 Nearby'}
            </button>
          ))}
        </div>

        <button
          className="btn btn-primary feed-page__new-btn"
          onClick={() => setShowCreate(true)}
        >
          + New Post
        </button>
      </div>

      <PostFeed
        fetcher={activeFetcher}
        refreshKey={refreshKey * 10 + ['public', 'friends', 'nearby'].indexOf(mode)}
        emptyText={
          mode === 'nearby'  ? 'No nearby posts found' :
          mode === 'friends' ? 'No posts from friends yet' :
                               'No posts yet — be the first!'
        }
      />

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
