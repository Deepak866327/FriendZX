import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { Post, FeedPage } from '@/services/postService';
import { PostCard } from './PostCard';
import { SkeletonCard } from './SkeletonCard';
import { staggerListVariants, staggerItemVariants, feedItemVariants } from '@/utils/animations';

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
  const [posts,     setPosts]     = useState<Post[]>([]);
  const [cursor,    setCursor]    = useState<string | undefined>(undefined);
  const [hasMore,   setHasMore]   = useState(true);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [isInitial, setIsInitial] = useState(true);
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
      if (reset) setIsInitial(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [fetcher, cursor, hasMore]);

  useEffect(() => {
    setPosts([]);
    setCursor(undefined);
    setHasMore(true);
    setIsInitial(true);
    load(true);
  }, [refreshKey, fetcher]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInitial(false);
          load();
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [load]);

  const handleDelete     = (id: string) => setPosts(prev => prev.filter(p => p.id !== id));
  const handleLikeChange = (updated: Post) =>
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));

  if (!loading && !error && posts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="glass rounded-2xl p-10 flex flex-col items-center gap-3 text-center mt-2"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.12))' }}
        >
          <FileText size={24} className="text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">{emptyText}</p>
          <p className="text-xs text-slate-400 mt-0.5">Check back soon</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div>
      {/* Initial batch uses stagger; scroll-loaded items animate individually */}
      {isInitial ? (
        <motion.div variants={staggerListVariants} initial="hidden" animate="visible">
          {posts.map(post => (
            <motion.div key={post.id} variants={staggerItemVariants}>
              <PostCard post={post} onDelete={handleDelete} onLikeChange={handleLikeChange} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        posts.map(post => (
          <motion.div key={post.id} variants={feedItemVariants} initial="hidden" animate="visible">
            <PostCard post={post} onDelete={handleDelete} onLikeChange={handleLikeChange} />
          </motion.div>
        ))
      )}

      {loading && (
        <>
          <SkeletonCard />
          <SkeletonCard textOnly />
        </>
      )}

      {error && (
        <div className="glass rounded-2xl px-4 py-3 text-sm text-rose-500 text-center mt-2">
          {error}
        </div>
      )}

      {!loading && hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

      {!hasMore && posts.length > 0 && (
        <p className="text-center text-xs text-slate-400 py-6">You're all caught up ✓</p>
      )}
    </div>
  );
};
