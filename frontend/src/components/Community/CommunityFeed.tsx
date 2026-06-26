import React, { useEffect, useState, useCallback } from 'react';
import communityService, { Community } from '@/services/communityService';
import challengeService, { CommunityChallenge } from '@/services/challengeService';
import { CommunityCard } from './CommunityCard';
import { PostFeed } from '@/components/Posts/PostFeed';
import { CreateCommunityModal } from './CreateCommunityModal';
import { CommunityChallengeCard, CommunityChallengeModal } from '@/components/Challenge/CommunityChallengeCard';

interface CommunityFeedProps {
  onPostInCommunity: (communities: Community[]) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  refreshKey?: number;
}

type View = 'feed' | 'my' | 'challenges' | 'discover';

export const CommunityFeed: React.FC<CommunityFeedProps> = ({
  onPostInCommunity, userLocation, refreshKey = 0,
}) => {
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [discovered,    setDiscovered]    = useState<Community[]>([]);
  const [view,          setView]          = useState<View>('feed');
  const [showCreate,    setShowCreate]    = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [discLoading,   setDiscLoading]   = useState(false);
  const [feedRefresh,   setFeedRefresh]   = useState(0);

  // Challenge state
  const [challenges,       setChallenges]       = useState<CommunityChallenge[]>([]);
  const [chalLoading,      setChalLoading]       = useState(false);
  const [activeChalId,     setActiveChalId]      = useState<string | null>(null);
  const [showCreateChal,   setShowCreateChal]    = useState(false);
  const [chalTitle,        setChalTitle]         = useState('');
  const [chalCommunityId,  setChalCommunityId]   = useState('');
  const [chalType,         setChalType]          = useState('math');
  const [chalCreating,     setChalCreating]      = useState(false);
  const [chalCreateError,  setChalCreateError]   = useState('');

  // ── Data loaders ────────────────────────────────────────────────────────────

  const loadMine = useCallback(async () => {
    try {
      const data = await communityService.getMine();
      setMyCommunities(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  const loadDiscover = useCallback(async () => {
    setDiscLoading(true);
    try {
      const data = await communityService.discover(
        userLocation?.latitude, userLocation?.longitude
      );
      setDiscovered(data);
    } catch { /* silent */ }
    finally { setDiscLoading(false); }
  }, [userLocation]);

  const loadChallenges = useCallback(async (communities: Community[]) => {
    if (communities.length === 0) { setChallenges([]); return; }
    setChalLoading(true);
    try {
      const results = await Promise.all(
        communities.map(c => challengeService.getCommunityChallenges(c.id).catch(() => []))
      );
      // Flatten, deduplicate by id, sort newest first
      const flat = results.flat();
      const seen = new Set<string>();
      const unique = flat.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
      unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setChallenges(unique);
    } catch { /* silent */ }
    finally { setChalLoading(false); }
  }, []);

  useEffect(() => { loadMine(); }, [loadMine, refreshKey]);

  useEffect(() => {
    if (view === 'discover') loadDiscover();
    if (view === 'challenges') loadChallenges(myCommunities);
  }, [view, loadDiscover, loadChallenges, myCommunities]);

  // Adapt page-based community feed to the cursor-based PostFeed interface
  const communityPageRef = React.useRef(1);
  const myFeedFetcher = useCallback(
    (_cursor?: string) => {
      const page = _cursor ? communityPageRef.current++ : (communityPageRef.current = 1);
      return communityService.getMyFeed(page).then(r => ({
        posts:      r.posts,
        nextCursor: r.hasMore ? String(page + 1) : null,
        hasMore:    r.hasMore,
      }));
    },
    [],
  );

  const handleCreated = (c: Community) => {
    setMyCommunities(prev => [c, ...prev]);
    setFeedRefresh(k => k + 1);
  };

  const handleUpdated = () => {
    loadMine();
    setFeedRefresh(k => k + 1);
  };

  // ── Create challenge ─────────────────────────────────────────────────────────

  const openCreateChallenge = () => {
    setChalCommunityId(myCommunities[0]?.id ?? '');
    setChalTitle('');
    setChalType('math');
    setChalCreateError('');
    setShowCreateChal(true);
  };

  const handleCreateChallenge = async () => {
    if (!chalCommunityId) { setChalCreateError('Select a community'); return; }
    if (!chalTitle.trim()) { setChalCreateError('Enter a challenge title'); return; }
    setChalCreating(true);
    setChalCreateError('');
    try {
      await challengeService.createCommunityChallenge(chalCommunityId, chalTitle.trim(), chalType);
      setShowCreateChal(false);
      setChalTitle('');
      loadChallenges(myCommunities);
    } catch {
      setChalCreateError('Failed to create challenge. Try again.');
    } finally {
      setChalCreating(false);
    }
  };

  const totalPending = challenges.filter(c => !c.myAttempt).length;

  if (loading) return <div className="feed-loading">Loading communities…</div>;

  return (
    <div className="community-feed">
      {/* Sub-tabs */}
      <div className="community-feed__tabs">
        <button
          className={`community-feed__tab${view === 'feed' ? ' active' : ''}`}
          onClick={() => setView('feed')}
        >
          Home
        </button>
        <button
          className={`community-feed__tab${view === 'my' ? ' active' : ''}`}
          onClick={() => setView('my')}
        >
          My{myCommunities.length > 0 ? ` (${myCommunities.length})` : ''}
        </button>
        <button
          className={`community-feed__tab community-feed__tab--challenges${view === 'challenges' ? ' active' : ''}`}
          onClick={() => setView('challenges')}
          style={{ position: 'relative' }}
        >
          🎯 Challenges
          {totalPending > 0 && view !== 'challenges' && (
            <span className="comm-chal-tab-badge">{totalPending}</span>
          )}
        </button>
        <button
          className={`community-feed__tab${view === 'discover' ? ' active' : ''}`}
          onClick={() => setView('discover')}
        >
          Discover
        </button>
        <button className="btn btn-sm btn-primary community-feed__create-btn" onClick={() => setShowCreate(true)}>
          + New
        </button>
      </div>

      {/* ── Feed view ─────────────────────────────────────────────────────────── */}
      {view === 'feed' && (
        myCommunities.length === 0 ? (
          <div className="community-feed__empty">
            <div className="community-feed__empty-icon">🏘️</div>
            <p>You haven't joined any communities yet.</p>
            <button className="btn btn-primary" onClick={() => setView('discover')}>
              Discover Communities
            </button>
            <button className="btn btn-secondary" style={{ marginTop: '8px' }} onClick={() => setShowCreate(true)}>
              Create One
            </button>
          </div>
        ) : (
          <>
            <div className="community-feed__your-communities">
              {myCommunities.map(c => (
                <CommunityCard
                  key={c.id}
                  community={c}
                  onUpdated={handleUpdated}
                  compact
                  onClick={() => onPostInCommunity(myCommunities)}
                />
              ))}
            </div>
            <div className="community-feed__post-hint">
              <button
                className="btn btn-outline community-feed__post-btn"
                onClick={() => onPostInCommunity(myCommunities)}
              >
                ✏️ Post to a community
              </button>
            </div>
            <PostFeed fetcher={myFeedFetcher} refreshKey={feedRefresh + refreshKey} />
          </>
        )
      )}

      {/* ── My communities list ───────────────────────────────────────────────── */}
      {view === 'my' && (
        <div className="community-grid">
          {myCommunities.length === 0 ? (
            <div className="community-feed__empty">
              <p>You haven't joined any communities yet.</p>
            </div>
          ) : (
            myCommunities.map(c => (
              <CommunityCard key={c.id} community={c} onUpdated={handleUpdated} />
            ))
          )}
        </div>
      )}

      {/* ── Challenges view ───────────────────────────────────────────────────── */}
      {view === 'challenges' && (
        <div className="comm-chal-view">
          {/* Header */}
          <div className="comm-chal-header">
            <div>
              <h3 className="comm-chal-title">Community Challenges</h3>
              <p className="comm-chal-subtitle">
                Math duels from your communities — 10 questions, 8/10 to pass
              </p>
            </div>
            {myCommunities.length > 0 && (
              <button className="btn btn-sm btn-primary" onClick={openCreateChallenge}>
                + Create
              </button>
            )}
          </div>

          {/* Create form */}
          {showCreateChal && (
            <div className="comm-chal-create">
              <p className="comm-chal-create-label">New Challenge</p>
              <select
                className="comm-chal-select"
                value={chalCommunityId}
                onChange={e => setChalCommunityId(e.target.value)}
              >
                {myCommunities.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                className="comm-chal-input"
                type="text"
                placeholder="Challenge title (e.g. Monday Maths)"
                maxLength={60}
                value={chalTitle}
                onChange={e => setChalTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateChallenge()}
              />
              {/* Type fixed to Math */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--card-2)', borderRadius: '10px', fontSize: '13px', color: 'var(--ig-secondary)' }}>
                <span>🔢</span><span>Maths · Arithmetic &amp; Number Sense</span>
              </div>
              {chalCreateError && (
                <p className="comm-chal-error">{chalCreateError}</p>
              )}
              <div className="comm-chal-create-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateChal(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleCreateChallenge}
                  disabled={chalCreating || !chalTitle.trim()}
                >
                  {chalCreating ? 'Creating…' : 'Create Challenge'}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {chalLoading ? (
            <div className="feed-loading">Loading challenges…</div>
          ) : myCommunities.length === 0 ? (
            <div className="community-feed__empty">
              <div className="community-feed__empty-icon">🎯</div>
              <p>Join a community to see and create challenges.</p>
              <button className="btn btn-primary" onClick={() => setView('discover')}>
                Discover Communities
              </button>
            </div>
          ) : challenges.length === 0 ? (
            <div className="community-feed__empty">
              <div className="community-feed__empty-icon">🎯</div>
              <p>No active challenges yet.</p>
              <p style={{ fontSize: '12px', color: 'var(--tx-3)' }}>
                Be the first — create a math challenge for your community!
              </p>
              <button className="btn btn-primary" onClick={openCreateChallenge}>
                + Create Challenge
              </button>
            </div>
          ) : (
            <div className="comm-chal-list">
              {/* Unattempted first */}
              {challenges.filter(c => !c.myAttempt).length > 0 && (
                <p className="comm-chal-section-label">🔥 Pending ({challenges.filter(c => !c.myAttempt).length})</p>
              )}
              {challenges.filter(c => !c.myAttempt).map(c => (
                <CommunityChallengeCard
                  key={c.id}
                  challenge={c}
                  communityName={myCommunities.find(m => m.id === c.communityId)?.name}
                  onOpen={id => setActiveChalId(id)}
                />
              ))}

              {challenges.filter(c => !!c.myAttempt).length > 0 && (
                <p className="comm-chal-section-label" style={{ marginTop: '12px' }}>✅ Completed</p>
              )}
              {challenges.filter(c => !!c.myAttempt).map(c => (
                <CommunityChallengeCard
                  key={c.id}
                  challenge={c}
                  communityName={myCommunities.find(m => m.id === c.communityId)?.name}
                  onOpen={id => setActiveChalId(id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Discover ──────────────────────────────────────────────────────────── */}
      {view === 'discover' && (
        <div className="community-grid">
          {discLoading ? (
            <div className="feed-loading">Finding communities…</div>
          ) : discovered.length === 0 ? (
            <div className="community-feed__empty">
              <p>No public communities found. Be the first!</p>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Community</button>
            </div>
          ) : (
            discovered.map(c => (
              <CommunityCard key={c.id} community={c} onUpdated={() => { loadMine(); loadDiscover(); }} />
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateCommunityModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          userLocation={userLocation}
        />
      )}

      {activeChalId && (
        <CommunityChallengeModal
          challengeId={activeChalId}
          onClose={() => {
            setActiveChalId(null);
            loadChallenges(myCommunities); // refresh scores after attempt
          }}
        />
      )}
    </div>
  );
};
