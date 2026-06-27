import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, MapPin, UserPlus, Check, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

const GRAD = [
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-purple-600',
  'from-sky-400 to-blue-500',
  'from-pink-500 to-rose-500',
];

interface SearchBarProps {
  inputRef?: React.RefObject<HTMLInputElement>;
}

export const SearchBar: React.FC<SearchBarProps> = ({ inputRef }) => {
  const { nearbyUsers, searchRadius } = useLocation();
  const { user: currentUser } = useAuth();

  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<PublicProfile[]>([]);
  const [isOpen, setIsOpen]         = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [followStates, setFollowStates] = useState<Record<string, FollowState>>({});

  const containerRef  = useRef<HTMLDivElement>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); setIsOpen(false); return; }

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleFollow = useCallback(async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
      setFollowStates(s => ({ ...s, [userId]: msg.toLowerCase().includes('already following') ? 'following' : prev }));
    }
  }, [followStates]);

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

  const nearbyList = sortedResults.filter(r => r.isNearby);
  const farList    = sortedResults.filter(r => !r.isNearby);

  const handleClear = () => { setQuery(''); setResults([]); setIsOpen(false); };

  return (
    <div ref={containerRef} className="relative w-full">

      {/* ── Input ── */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          className="input-glass pl-10 pr-10"
          placeholder="Search people…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => sortedResults.length > 0 && setIsOpen(true)}
        />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader size={14} className="animate-spin text-slate-400" />
          ) : query ? (
            <button onClick={handleClear} aria-label="Clear" className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Dropdown ── */}
      <AnimatePresence>
        {isOpen && sortedResults.length > 0 && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-2 glass rounded-2xl overflow-hidden"
            style={{ maxHeight: 360, overflowY: 'auto', zIndex: 100 }}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            {nearbyList.length > 0 && (
              <>
                <GroupLabel>
                  <MapPin size={9} className="inline mr-1" />
                  Within {fmtRadius(searchRadius)}
                </GroupLabel>
                {nearbyList.map(r => (
                  <ResultRow key={r.userId} result={r} isSelf={r.userId === currentUser?.id} followState={followStates[r.userId] ?? 'idle'} onFollow={handleFollow} onClose={() => setIsOpen(false)} />
                ))}
              </>
            )}

            {farList.length > 0 && (
              <>
                <GroupLabel className={nearbyList.length > 0 ? 'border-t border-white/30' : ''}>
                  {nearbyList.length > 0 ? `Outside ${fmtRadius(searchRadius)}` : 'All results'}
                </GroupLabel>
                {farList.map(r => (
                  <ResultRow key={r.userId} result={r} isSelf={r.userId === currentUser?.id} followState={followStates[r.userId] ?? 'idle'} onFollow={handleFollow} onClose={() => setIsOpen(false)} />
                ))}
              </>
            )}
          </motion.div>
        )}

        {isOpen && sortedResults.length === 0 && !isLoading && query.length >= 2 && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-2 glass rounded-2xl px-4 py-6 text-center text-sm text-slate-400"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            No users found for &ldquo;{query}&rdquo;
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Sub-components ── */

const GroupLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider ${className}`}>
    {children}
  </div>
);

interface RowProps {
  result: SearchResult;
  isSelf: boolean;
  followState: FollowState;
  onFollow: (userId: string, e: React.MouseEvent) => void;
  onClose: () => void;
}

const ResultRow: React.FC<RowProps> = ({ result, isSelf, followState, onFollow, onClose }) => {
  const gradIdx = (result.userId?.charCodeAt(0) ?? 0) % GRAD.length;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/30 cursor-pointer transition-colors"
      onClick={onClose}
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${GRAD[gradIdx]} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden`}>
        {result.photos?.[0]
          ? <img src={result.photos[0]} alt="" className="w-full h-full object-cover" />
          : result.firstName?.charAt(0)?.toUpperCase() || '?'}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate flex items-center gap-1.5">
          {result.firstName} {result.lastName}
          {isSelf && (
            <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50/80 px-1.5 py-0.5 rounded-full">You</span>
          )}
        </div>
        {(result.followers ?? 0) > 0 && (
          <span className="text-[10px] text-slate-400">{result.followers} followers</span>
        )}
      </div>

      {/* Distance + follow */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {result.isNearby && (
          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <MapPin size={8} />
            {fmtDist(result.distance!)}
          </span>
        )}
        {!isSelf && (
          <button
            className={followState === 'following' ? 'btn-secondary' : 'btn-primary'}
            disabled={followState === 'loading'}
            onClick={e => onFollow(result.userId, e)}
            style={{ fontSize: 11, minHeight: 30, paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10, borderRadius: 10 }}
          >
            {followState === 'loading' ? (
              <Loader size={11} className="animate-spin" />
            ) : followState === 'following' ? (
              <><Check size={11} /> Following</>
            ) : (
              <><UserPlus size={11} /> Follow</>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
