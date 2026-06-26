import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Post, FeedPage } from '@/services/postService';
import { Cration, CrationPage } from '@/services/crationService';
import { PostCard } from './PostCard';
import { SkeletonCard } from './SkeletonCard';
import { CrationCard } from '@/components/Cration/CrationCard';

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
    } catch {
      setError('Failed to load feed');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [postFetcher, crationFetcher, postHasMore, crationHasMore]);

  // Reset on fetcher / refresh change
  useEffect(() => {
    setItems([]);
    setPostCursor(undefined);
    setCrationPage(1);
    setPostHasMore(true);
    setCrationHasMore(true);
    load(undefined, 1, true);
  }, [postFetcher, crationFetcher, refreshKey]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) load(postCursor, crationPage, false); },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [load, postCursor, crationPage]);

  const handleDeletePost = (id: string) =>
    setItems(prev => prev.filter(i => !(i.type === 'post' && i.id === id)));

  if (!loading && !error && items.length === 0) {
    return <p className="feed-empty">Nothing here yet.</p>;
  }

  const hasMore = postHasMore || crationHasMore;

  return (
    <div className="mixed-feed">
      {items.map(item =>
        item.type === 'post' ? (
          <PostCard key={`post-${item.id}`} post={item.data} onDelete={handleDeletePost} />
        ) : (
          <CrationCard key={`cration-${item.id}`} cration={item.data} onClick={() => onOpenCration(item.data)} />
        )
      )}

      {loading && <><SkeletonCard /><SkeletonCard /></>}
      {error   && <p className="feed-error">{error}</p>}

      {!loading && hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
      {!hasMore && items.length > 0 && <p className="feed-end">You're all caught up</p>}
    </div>
  );
};
