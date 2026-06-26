import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import { PublicProfile } from '@/types/api';

interface SearchResult extends PublicProfile {
  distance?: number;
  isNearby: boolean;
}

type FollowState = 'idle' | 'following' | 'loading';

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function fmtRadius(r: number): string {
  return r >= 1000 ? `${(r / 1000).toFixed(0)} km` : `${r} m`;
}

interface SearchBarProps {
  inputRef?: React.RefObject<HTMLInputElement>;
}

export const SearchBar: React.FC<SearchBarProps> = ({ inputRef }) => {
  const { nearbyUsers, searchRadius } = useLocation();
  const { user: currentUser } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Track follow state per userId: 'idle' | 'following' | 'loading'
  const [followStates, setFollowStates] = useState<Record<string, FollowState>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await userService.searchUsers(query.trim());
        setResults(data);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleFollow = useCallback(async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // keep dropdown open
    const prev = followStates[userId] ?? 'idle';
    if (prev === 'loading') return;

    setFollowStates(s => ({ ...s, [userId]: 'loading' }));
    try {
      if (prev === 'following') {
        await userService.unfollowUser(userId);
        setFollowStates(s => ({ ...s, [userId]: 'idle' }));
      } else {
        await userService.followUser(userId);
        setFollowStates(s => ({ ...s, [userId]: 'following' }));
      }
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      // If backend says already following, sync state accordingly
      if (msg.toLowerCase().includes('already following')) {
        setFollowStates(s => ({ ...s, [userId]: 'following' }));
      } else {
        setFollowStates(s => ({ ...s, [userId]: prev }));
      }
    }
  }, [followStates]);

  // Sort: nearby first (closest), then by followers
  const sortedResults = useMemo<SearchResult[]>(() => {
    return results
      .map(profile => {
        const nearby = nearbyUsers.find(n => n.userId === profile.userId);
        return { ...profile, distance: nearby?.distance, isNearby: !!nearby };
      })
      .sort((a, b) => {
        if (a.isNearby && b.isNearby) return (a.distance ?? Infinity) - (b.distance ?? Infinity);
        if (a.isNearby) return -1;
        if (b.isNearby) return 1;
        return (b.followers ?? 0) - (a.followers ?? 0);
      });
  }, [results, nearbyUsers]);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const nearbyList = sortedResults.filter(r => r.isNearby);
  const farList = sortedResults.filter(r => !r.isNearby);

  return (
    <div className="search-bar-wrap" ref={containerRef}>
      <div className="search-bar-inner">
        <svg className="search-bar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-bar-input"
          placeholder="Search people…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => sortedResults.length > 0 && setIsOpen(true)}
        />
        {isLoading && <span className="search-bar-spinner" />}
        {query && !isLoading && (
          <button className="search-bar-clear" onClick={handleClear} aria-label="Clear">×</button>
        )}
      </div>

      {isOpen && (
        <div className="search-dropdown">
          {sortedResults.length > 0 ? (
            <>
              {nearbyList.length > 0 && (
                <div className="search-group-label">📍 Within {fmtRadius(searchRadius)}</div>
              )}
              {nearbyList.map(r => (
                <SearchResultRow
                  key={r.userId}
                  result={r}
                  isSelf={r.userId === currentUser?.id}
                  followState={followStates[r.userId] ?? 'idle'}
                  onFollow={handleFollow}
                  onClose={() => setIsOpen(false)}
                />
              ))}

              {farList.length > 0 && (
                <div className={`search-group-label${nearbyList.length > 0 ? ' search-group-label-far' : ''}`}>
                  {nearbyList.length > 0 ? `Outside ${fmtRadius(searchRadius)}` : 'All results'}
                </div>
              )}
              {farList.map(r => (
                <SearchResultRow
                  key={r.userId}
                  result={r}
                  isSelf={r.userId === currentUser?.id}
                  followState={followStates[r.userId] ?? 'idle'}
                  onFollow={handleFollow}
                  onClose={() => setIsOpen(false)}
                />
              ))}
            </>
          ) : (
            <div className="search-no-results">No users found for "{query}"</div>
          )}
        </div>
      )}
    </div>
  );
};

interface RowProps {
  result: SearchResult;
  isSelf: boolean;
  followState: FollowState;
  onFollow: (userId: string, e: React.MouseEvent) => void;
  onClose: () => void;
}

const SearchResultRow: React.FC<RowProps> = ({ result, isSelf, followState, onFollow, onClose }) => (
  <div className="search-result-item" onClick={onClose}>
    <div className="search-result-avatar">
      {result.photos?.[0] ? (
        <img src={result.photos[0]} alt="" />
      ) : (
        <span>{result.firstName?.charAt(0)?.toUpperCase() || '?'}</span>
      )}
    </div>

    <div className="search-result-info">
      <div className="search-result-name">
        {result.firstName} {result.lastName}
        {isSelf && <span className="search-self-tag">You</span>}
      </div>
      <div className="search-result-meta">
        <span className="search-result-uid" title={result.userId}>
          ID: {result.userId.slice(0, 8)}…
        </span>
        {(result.followers ?? 0) > 0 && (
          <span className="search-result-followers">{result.followers} followers</span>
        )}
      </div>
    </div>

    <div className="search-result-badge-wrap">
      {result.isNearby && (
        <span className="search-result-badge nearby">📍 {fmtDist(result.distance!)}</span>
      )}

      {!isSelf && (
        <button
          className={`search-friend-btn ${followState === 'following' ? 'following' : ''}`}
          disabled={followState === 'loading'}
          onClick={e => onFollow(result.userId, e)}
          title={followState === 'following' ? 'Unfollow' : 'Add Friend'}
        >
          {followState === 'loading' ? (
            <span className="search-friend-spinner" />
          ) : followState === 'following' ? (
            '✓ Following'
          ) : (
            '+ Add Friend'
          )}
        </button>
      )}
    </div>
  </div>
);
