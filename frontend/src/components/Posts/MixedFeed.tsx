import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { Post, FeedPage } from '@/services/postService';
import { Cration, CrationPage } from '@/services/crationService';
import { PostCard } from './PostCard';
import { SkeletonCard } from './SkeletonCard';
import { CrationCard } from '@/components/Cration/CrationCard';
import { staggerListVariants, staggerItemVariants, feedItemVariants } from '@/utils/animations';

type FeedItem =
  | { type: 'post';    id: string; createdAt: string; data: Post }
  | { type: 'cration'; id: string; createdAt: string; data: Cration };

interface MixedFeedProps {
  postFetcher:    (cursor?: string) => Promise<FeedPage>;
  crationFetcher: (page: number)   => Promise<CrationPage>;
  onOpenCration:  (cration: Cration) => void;
  refreshKey?:    number;
}

function merge(existing: FeedItem[], next: FeedItem[]): FeedItem[] {
  const ids = new Set(existing.map(i => i.type + i.id));
  return [...existing, ...next.filter(i => !ids.has(i.type + i.id))].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export const MixedFeed: React.FC<MixedFeedProps> = ({
  postFetcher, crationFetcher, onOpenCration, refreshKey,
}) => {
  const [items,          setItems]          = useState<FeedItem[]>([]);
  const [postCursor,     setPostCursor]     = useState<string | undefined>(undefined);
  const [crationPage,    setCrationPage]    = useState(1);
  const [postHasMore,    setPostHasMore]    = useState(true);
  const [crationHasMore, setCrationHasMore] = useState(true);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [isInitial,      setIsInitial]      = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef  = useRef(false);

  const load = useCallback(async (pCursor: string | undefined, cp: number, reset: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const [postResult, crationResult] = await Promise.allSettled([
        postHasMore || reset ? postFetcher(reset ? undefined : pCursor) : Promise.resolve(null),
        crationHasMore || reset ? crationFetcher(reset ? 1 : cp) : Promise.resolve(null),
      ]);

      const newPosts: FeedItem[] =
        postResult.status === 'fulfilled' && postResult.value
          ? postResult.value.posts.map(p => ({ type: 'post', id: p.id, createdAt: p.createdAt, data: p }))
          : [];

      const newCrations: FeedItem[] =
        crationResult.status === 'fulfilled' && crationResult.value
          ? (crationResult.value as CrationPage).crations.map(c => ({ type: 'cration', id: c.id, createdAt: c.createdAt, data: c }))
          : [];

      if (postResult.status === 'fulfilled' && postResult.value) {
        setPostHasMore(postResult.value.hasMore);
        setPostCursor(postResult.value.nextCursor ?? undefined);
      }
      if (crationResult.status === 'fulfilled' && crationResult.value) {
        setCrationHasMore((crationResult.value as CrationPage).hasMore ?? false);
        if (!reset) setCrationPage(cp + 1);
      }

      const batch = [...newPosts, ...newCrations].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setItems(prev => reset ? batch : merge(prev, batch));
      if (reset) setIsInitial(true);
    } catch {
      setError('Failed to load feed');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [postFetcher, crationFetcher, postHasMore, crationHasMore]);

  useEffect(() => {
    setItems([]);
    setPostCursor(undefined);
    setCrationPage(1);
    setPostHasMore(true);
    setCrationHasMore(true);
    setIsInitial(true);
    load(undefined, 1, true);
  }, [postFetcher, crationFetcher, refreshKey]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInitial(false);
          load(postCursor, crationPage, false);
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [load, postCursor, crationPage]);

  const handleDeletePost = (id: string) =>
    setItems(prev => prev.filter(i => !(i.type === 'post' && i.id === id)));

  if (!loading && !error && items.length === 0) {
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
          <p className="text-sm font-semibold text-slate-700">Nothing here yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Be the first to post something!</p>
        </div>
      </motion.div>
    );
  }

  const hasMore = postHasMore || crationHasMore;

  const renderItem = (item: FeedItem) =>
    item.type === 'post' ? (
      <PostCard key={`post-${item.id}`} post={item.data} onDelete={handleDeletePost} />
    ) : (
      <CrationCard key={`cration-${item.id}`} cration={item.data} onClick={() => onOpenCration(item.data)} />
    );

  return (
    <div>
      {isInitial ? (
        <motion.div variants={staggerListVariants} initial="hidden" animate="visible">
          {items.map(item => (
            <motion.div key={item.type + item.id} variants={staggerItemVariants}>
              {renderItem(item)}
            </motion.div>
          ))}
        </motion.div>
      ) : (
        items.map(item => (
          <motion.div key={item.type + item.id} variants={feedItemVariants} initial="hidden" animate="visible">
            {renderItem(item)}
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

      {!hasMore && items.length > 0 && (
        <p className="text-center text-xs text-slate-400 py-6">You're all caught up ✓</p>
      )}
    </div>
  );
};
