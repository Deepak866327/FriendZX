import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Post, FeedPage } from '@/services/postService';
import { PostCard } from './PostCard';
import { SkeletonCard } from './SkeletonCard';

type Fetcher = (cursor?: string, limit?: number) => Promise<FeedPage>;

interface PostFeedProps {
  fetcher:     Fetcher;
  refreshKey?: number;
  emptyText?:  string;
}

export const PostFeed: React.FC<PostFeedProps> = ({
  fetcher,
  refreshKey = 0,
  emptyText  = 'No posts yet',
}) => {
  const [posts,   setPosts]   = useState<Post[]>([]);
  const [cursor,  setCursor]  = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef  = useRef(false);

  const load = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    const nextCursor = reset ? undefined : cursor;
    if (!reset && !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const page = await fetcher(nextCursor, 20);
      setPosts(prev => reset ? page.posts : [...prev, ...page.posts]);
      setCursor(page.nextCursor ?? undefined);
      setHasMore(page.hasMore);
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [fetcher, cursor, hasMore]);

  // Initial load + refresh
  useEffect(() => {
    setPosts([]);
    setCursor(undefined);
    setHasMore(true);
    load(true);
  }, [refreshKey, fetcher]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) load(); },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [load]);

  const handleDelete = (id: string) => setPosts(prev => prev.filter(p => p.id !== id));
  const handleLikeChange = (updated: Post) =>
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));

  if (!loading && !error && posts.length === 0) {
    return <p className="feed-empty">{emptyText}</p>;
  }

  return (
    <div className="post-feed">
      {posts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          onDelete={handleDelete}
          onLikeChange={handleLikeChange}
        />
      ))}

      {loading && (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {error && <p className="feed-error">{error}</p>}

      {!loading && hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

      {!hasMore && posts.length > 0 && (
        <p className="feed-end">You're all caught up</p>
      )}
    </div>
  );
};
