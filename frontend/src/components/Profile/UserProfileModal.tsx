import React, { useEffect, useState, useCallback, useRef } from 'react';
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

type Tab = 'posts' | 'crations';

interface UserProfileModalProps {
  userId:  string;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ userId, onClose }) => {
  const { user: me } = useAuth();

  const [profile,     setProfile]     = useState<PublicProfile | null>(null);
  const [loadingP,    setLoadingP]    = useState(true);
  const [tab,         setTab]         = useState<Tab>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Posts (cursor-based)
  const [posts,      setPosts]      = useState<Post[]>([]);
  const [postCursor, setPostCursor] = useState<string | undefined>();
  const [postMore,   setPostMore]   = useState(true);
  const [postLoading,setPostLoading]= useState(false);
  const postLoadingRef = useRef(false);

  // Crations (page-based)
  const [crations,    setCrations]    = useState<Cration[]>([]);
  const [crationPage, setCrationPage] = useState(1);
  const [crationMore, setCrationMore] = useState(true);
  const [crationLoad, setCrationLoad] = useState(false);
  const [activeCration, setActiveCration] = useState<Cration | null>(null);
  const [chatTarget,    setChatTarget]    = useState<PublicProfile | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Load profile + relationship
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

  // Load posts
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

  // Load crations
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

  // Infinite scroll for posts
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

  return (
    <>
      <div className="modal-overlay up-overlay" onClick={onClose}>
        <div className="up-modal" onClick={e => e.stopPropagation()}>

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="up-modal__topbar">
            <button className="modal-close" onClick={onClose}>✕</button>
            <span className="up-modal__topbar-title">Profile</span>
            <span style={{ width: 32 }} />
          </div>

          {loadingP ? (
            <div className="up-modal__loading"><div className="loading-spinner" /></div>
          ) : (
            <>
              {/* ── Profile header ────────────────────────────────── */}
              <div className="up-header">
                <div className="up-avatar">
                  {profile?.photos?.[0]
                    ? <img src={profile.photos[0]} alt="" className="up-avatar__img" />
                    : <span className="up-avatar__initial">{initial}</span>}
                </div>

                <div className="up-stats">
                  <div className="up-stat">
                    <span className="up-stat__num">{profile?.followers ?? 0}</span>
                    <span className="up-stat__lbl">Followers</span>
                  </div>
                  <div className="up-stat">
                    <span className="up-stat__num">{profile?.following ?? 0}</span>
                    <span className="up-stat__lbl">Following</span>
                  </div>
                  <div className="up-stat">
                    <span className="up-stat__num">{posts.length > 0 ? posts.length + (postMore ? '+' : '') : '—'}</span>
                    <span className="up-stat__lbl">Posts</span>
                  </div>
                </div>
              </div>

              {/* ── Bio ──────────────────────────────────────────── */}
              <div className="up-bio">
                <p className="up-bio__name">{displayName}</p>
                {profile?.username && <p className="up-bio__username">@{profile.username}</p>}
                {profile?.bio && <p className="up-bio__text">{profile.bio}</p>}
                {profile?.interests?.length ? (
                  <div className="up-bio__interests">
                    {profile.interests.slice(0, 5).map(i => (
                      <span key={i} className="up-bio__tag">{i}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* ── Action buttons ────────────────────────────────── */}
              {me?.id !== userId && (
                <div className="up-actions">
                  <button
                    className={`up-btn ${isFollowing ? 'up-btn--secondary' : 'up-btn--primary'}`}
                    onClick={toggleFollow}
                    disabled={followLoading}
                  >
                    {followLoading ? '…' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button
                    className="up-btn up-btn--secondary"
                    onClick={() => profile && setChatTarget(profile)}
                  >
                    💬 Message
                  </button>
                </div>
              )}

              {/* ── Tabs ─────────────────────────────────────────── */}
              <div className="up-tabs">
                <button
                  className={`up-tab${tab === 'posts' ? ' up-tab--active' : ''}`}
                  onClick={() => setTab('posts')}
                >
                  <span className="up-tab__icon">📷</span> Posts
                </button>
                <button
                  className={`up-tab${tab === 'crations' ? ' up-tab--active' : ''}`}
                  onClick={() => setTab('crations')}
                >
                  <span className="up-tab__icon">🎬</span> Crations
                </button>
              </div>

              {/* ── Content ──────────────────────────────────────── */}
              <div className="up-content">

                {/* Posts tab */}
                {tab === 'posts' && (
                  <div className="up-posts-list">
                    {posts.length === 0 && !postLoading && (
                      <div className="up-empty">
                        <span className="up-empty__icon">📷</span>
                        <p>No posts yet</p>
                      </div>
                    )}
                    {posts.map(post => (
                      <PostCard key={post.id} post={post} />
                    ))}
                    {postLoading && <><SkeletonCard /><SkeletonCard /></>}
                    {!postLoading && postMore && <div ref={sentinelRef} style={{ height: 1 }} />}
                    {!postMore && posts.length > 0 && (
                      <p className="feed-end">All posts loaded</p>
                    )}
                  </div>
                )}

                {/* Crations tab */}
                {tab === 'crations' && (
                  <>
                    {crations.length === 0 && !crationLoad && (
                      <div className="up-empty">
                        <span className="up-empty__icon">🎬</span>
                        <p>No crations yet</p>
                      </div>
                    )}
                    <div className="up-crations-grid">
                      {crations.map(c => (
                        <CrationCard
                          key={c.id}
                          cration={c}
                          onClick={() => setActiveCration(c)}
                        />
                      ))}
                    </div>
                    {crationLoad && (
                      <div className="up-grid-loading"><div className="cration-spinner" /></div>
                    )}
                    {!crationLoad && crationMore && (
                      <div style={{ textAlign: 'center', padding: '12px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => loadCrations(crationPage + 1)}
                        >
                          Load more
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {activeCration && (
        <CrationPlayerModal cration={activeCration} onClose={() => setActiveCration(null)} />
      )}
      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}
    </>
  );
};
