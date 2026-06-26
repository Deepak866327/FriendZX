import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import { PublicProfile } from '@/types/api';
import { ChatModal } from '@/components/Chat/ChatModal';
import { UserProfileModal } from '@/components/Profile/UserProfileModal';
import { useCallContext } from '@/context/CallContext';

const DISCOVER_LIMIT   = 100;
const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export const ExplorePage: React.FC = () => {
  const { nearbyUsers } = useLocation();
  const { user: currentUser } = useAuth();
  const { initiateCall } = useCallContext();

  const [query, setQuery]               = useState('');
  const [users, setUsers]               = useState<PublicProfile[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [addedIds, setAddedIds]         = useState<Set<string>>(new Set());
  const [addingId, setAddingId]         = useState<string | null>(null);
  const [rateLimitMsg,   setRateLimitMsg]   = useState('');
  const [chatTarget,     setChatTarget]     = useState<PublicProfile | null>(null);
  const [viewProfileId,  setViewProfileId]  = useState<string | null>(null);

  const debounceRef     = useRef<ReturnType<typeof setTimeout>>();
  const refreshTimerRef = useRef<ReturnType<typeof setInterval>>();

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const loadDiscover = useCallback(async () => {
    try {
      const results = await userService.discoverUsers(DISCOVER_LIMIT);
      setUsers(results);
    } catch {
      // silent background refresh — don't clear existing results on failure
    }
  }, []);

  // ── Initial load (shows spinner) ───────────────────────────────────────────

  const loadDiscoverInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await userService.discoverUsers(DISCOVER_LIMIT);
      setUsers(results);
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Initial load + search ──────────────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length === 1) {
      setIsSearchMode(true);
      return;
    }

    const delay = query.trim().length >= 2 ? 300 : 0;

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        if (query.trim().length >= 2) {
          setIsSearchMode(true);
          const results = await userService.searchUsers(query.trim(), 30);
          setUsers(results);
        } else {
          setIsSearchMode(false);
          await loadDiscoverInitial();
        }
      } catch {
        setUsers([]);
        setIsLoading(false);
      }
    }, delay);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, loadDiscoverInitial]);

  // ── Silent background refresh every 2 min (discover mode only) ────────────

  useEffect(() => {
    if (isSearchMode) {
      clearInterval(refreshTimerRef.current);
      return;
    }

    refreshTimerRef.current = setInterval(loadDiscover, REFRESH_INTERVAL);

    return () => clearInterval(refreshTimerRef.current);
  }, [isSearchMode, loadDiscover]);

  // ── Add friend ─────────────────────────────────────────────────────────────

  const handleAddFriend = useCallback(async (userId: string) => {
    setAddingId(userId);
    setRateLimitMsg('');
    try {
      await userService.addFriend(userId);
      setAddedIds(prev => new Set(prev).add(userId));
    } catch (err: any) {
      const status = err?.response?.status;
      const msg    = err?.response?.data?.error ?? '';
      if (status === 429) {
        setRateLimitMsg(msg || 'Follow limit reached (2,000 per 7 days). Try again later.');
      } else if (msg.includes('Already following')) {
        setAddedIds(prev => new Set(prev).add(userId));
      }
    } finally {
      setAddingId(null);
    }
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const getInitial     = (p: PublicProfile) => (p.firstName || p.userId).charAt(0).toUpperCase();
  const getDisplayName = (p: PublicProfile) =>
    p.firstName ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : p.userId.slice(0, 10) + '…';

  const nearbyMap = new Map(nearbyUsers.map(u => [u.userId, u.distance]));

  const sortedUsers = [...users]
    .filter(p => p.userId !== currentUser?.id)
    .sort((a, b) => {
      const aD = nearbyMap.get(a.userId);
      const bD = nearbyMap.get(b.userId);
      if (aD !== undefined && bD !== undefined) return aD - bD;
      if (aD !== undefined) return -1;
      if (bD !== undefined) return 1;
      return (b.followers ?? 0) - (a.followers ?? 0);
    });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="explore-page-wrap">
        {/* Header */}
        <div className="explore-header-bar">
          <h2 className="explore-title">
            {isSearchMode ? `Results for "${query}"` : 'Discover People'}
          </h2>
          <div className="explore-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ width: 15, height: 15, flexShrink: 0, color: 'var(--ig-secondary)' }}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="explore-search-input"
              type="text"
              placeholder="Search people…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ig-secondary)', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Rate limit warning */}
        {rateLimitMsg && (
          <div style={{
            margin: '8px 16px', padding: '10px 14px',
            background: 'rgba(237,73,86,.1)', border: '1px solid rgba(237,73,86,.3)',
            borderRadius: '10px', fontSize: '13px', color: '#ed4956',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
          }}>
            <span>⚠️ {rateLimitMsg}</span>
            <button onClick={() => setRateLimitMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ed4956', fontSize: '14px' }}>✕</button>
          </div>
        )}

        {/* Body */}
        {isLoading ? (
          <div className="loading" style={{ padding: '60px 0' }}>
            <div className="loading-spinner" />
          </div>
        ) : sortedUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--ig-secondary)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {isSearchMode ? '🔍' : '👥'}
            </div>
            <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>
              {isSearchMode ? 'No users found' : 'No users yet'}
            </p>
            {isSearchMode && (
              <p style={{ fontSize: '13px', margin: 0 }}>Try a different name or ID</p>
            )}
          </div>
        ) : (
          <>
            {!isSearchMode && nearbyUsers.length > 0 && (
              <div className="explore-section-label">📍 Nearby shown first</div>
            )}

            <div className="explore-grid">
              {sortedUsers.map(p => {
                const dist     = nearbyMap.get(p.userId);
                const isAdded  = addedIds.has(p.userId);
                const isAdding = addingId === p.userId;

                return (
                  <div key={p.userId} className="explore-card">
                    <div
                      className="explore-card-avatar"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setViewProfileId(p.userId)}
                      title="View profile"
                    >
                      {p.photos?.[0]
                        ? <img src={p.photos[0]} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : getInitial(p)}
                    </div>

                    <div className="explore-card-info" style={{ cursor: 'pointer' }} onClick={() => setViewProfileId(p.userId)}>
                      <div className="explore-card-name">{getDisplayName(p)}</div>
                      {p.username && <div style={{ fontSize: '12px', color: 'var(--ig-secondary)', marginTop: '1px' }}>@{p.username}</div>}
                      {p.bio && <div className="explore-card-bio">{p.bio}</div>}
                      <div className="explore-card-meta">
                        {(p.followers ?? 0) > 0 && (
                          <span>{p.followers} followers</span>
                        )}
                        {dist !== undefined && (
                          <span className="explore-nearby-badge">📍 {fmtDist(dist)}</span>
                        )}
                      </div>
                    </div>

                    <div className="explore-card-actions">
                      <button
                        className="btn btn-sm btn-primary"
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                        onClick={() => setChatTarget(p)}
                        title="Chat"
                      >
                        💬
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                        onClick={() => initiateCall(p, 'audio')}
                        title="Audio call"
                      >
                        📞
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                        onClick={() => initiateCall(p, 'video')}
                        title="Video call"
                      >
                        📹
                      </button>
                      <button
                        className={`btn btn-sm ${isAdded ? 'btn-secondary' : 'btn-outline'}`}
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                        onClick={() => !isAdded && handleAddFriend(p.userId)}
                        disabled={isAdded || isAdding}
                      >
                        {isAdding ? '…' : isAdded ? '✓' : '+ Add'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}
      {viewProfileId && (
        <UserProfileModal userId={viewProfileId} onClose={() => setViewProfileId(null)} />
      )}
    </>
  );
};
