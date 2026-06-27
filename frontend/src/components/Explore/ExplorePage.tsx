import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, MessageCircle, Phone, Video, UserPlus, UserCheck, Users, MapPin } from 'lucide-react';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import { PublicProfile } from '@/types/api';
import { ChatModal } from '@/components/Chat/ChatModal';
import { UserProfileModal } from '@/components/Profile/UserProfileModal';
import { useCallContext } from '@/context/CallContext';

const DISCOVER_LIMIT   = 100;
const REFRESH_INTERVAL = 2 * 60 * 1000;

const GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-purple-600',
  'from-sky-400 to-blue-500',
  'from-pink-500 to-rose-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
];
function avatarGradient(uid: string) {
  const n = uid.charCodeAt(0) + uid.charCodeAt(uid.length - 1);
  return GRADIENTS[n % GRADIENTS.length];
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export const ExplorePage: React.FC = () => {
  const { nearbyUsers } = useLocation();
  const { user: currentUser } = useAuth();
  const { initiateCall } = useCallContext();

  const [query,        setQuery]        = useState('');
  const [users,        setUsers]        = useState<PublicProfile[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [addedIds,     setAddedIds]     = useState<Set<string>>(new Set());
  const [addingId,     setAddingId]     = useState<string | null>(null);
  const [rateLimitMsg, setRateLimitMsg] = useState('');
  const [chatTarget,   setChatTarget]   = useState<PublicProfile | null>(null);
  const [viewProfileId,setViewProfileId]= useState<string | null>(null);

  const debounceRef     = useRef<ReturnType<typeof setTimeout>>();
  const refreshTimerRef = useRef<ReturnType<typeof setInterval>>();

  const loadDiscover = useCallback(async () => {
    try {
      const results = await userService.discoverUsers(DISCOVER_LIMIT);
      setUsers(results);
    } catch {}
  }, []);

  const loadDiscoverInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      setUsers(await userService.discoverUsers(DISCOVER_LIMIT));
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 1) { setIsSearchMode(true); return; }
    const delay = query.trim().length >= 2 ? 300 : 0;
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        if (query.trim().length >= 2) {
          setIsSearchMode(true);
          setUsers(await userService.searchUsers(query.trim(), 30));
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

  useEffect(() => {
    if (isSearchMode) { clearInterval(refreshTimerRef.current); return; }
    refreshTimerRef.current = setInterval(loadDiscover, REFRESH_INTERVAL);
    return () => clearInterval(refreshTimerRef.current);
  }, [isSearchMode, loadDiscover]);

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

  return (
    <>
      <div className="pb-24 pt-3">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">

          {/* Page header */}
          <div className="mb-4">
            <h1 className="text-xl font-bold text-slate-800">
              {isSearchMode
                ? <><span className="text-slate-400 font-normal">Results for </span><span className="gradient-text">"{query}"</span></>
                : <><span className="gradient-text">Explore</span> People</>}
            </h1>
            {!isSearchMode && (
              <p className="text-sm text-slate-400 mt-0.5">Discover interesting people around you</p>
            )}
          </div>

          {/* Search bar */}
          <div className="glass rounded-xl flex items-center gap-2.5 px-4 py-0 mb-5" style={{ minHeight: 48 }}>
            <Search size={16} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search people by name or username…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none py-3"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="btn-icon w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 flex-shrink-0"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Rate limit warning */}
          {rateLimitMsg && (
            <div className="glass rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3 border border-red-200/60 bg-red-50/60">
              <p className="text-sm text-red-600">{rateLimitMsg}</p>
              <button onClick={() => setRateLimitMsg('')} className="btn-icon w-7 h-7 rounded-lg text-red-400 flex-shrink-0">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Nearby label */}
          {!isSearchMode && nearbyUsers.length > 0 && !isLoading && (
            <div className="flex items-center gap-1.5 mb-3">
              <MapPin size={12} className="text-indigo-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nearby shown first</span>
            </div>
          )}

          {/* Body */}
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="glass rounded-2xl p-4 flex items-center gap-3">
                  <div className="skeleton w-12 h-12 rounded-full flex-shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="skeleton h-3 rounded-full w-2/5" />
                    <div className="skeleton h-2.5 rounded-full w-1/4" />
                    <div className="skeleton h-2.5 rounded-full w-3/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="glass rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/60 flex items-center justify-center">
                <Users size={26} className="text-indigo-300" />
              </div>
              <div>
                <p className="font-semibold text-slate-700 mb-1">
                  {isSearchMode ? 'No users found' : 'No users yet'}
                </p>
                {isSearchMode && <p className="text-sm text-slate-400">Try a different name or username</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedUsers.map(p => {
                const dist     = nearbyMap.get(p.userId);
                const isAdded  = addedIds.has(p.userId);
                const isAdding = addingId === p.userId;

                return (
                  <div key={p.userId} className="glass-hover rounded-2xl p-4 flex items-center gap-3">
                    {/* Avatar */}
                    <button
                      className="flex-shrink-0"
                      onClick={() => setViewProfileId(p.userId)}
                      aria-label="View profile"
                    >
                      {p.photos?.[0] ? (
                        <img
                          src={p.photos[0]}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-avatar"
                        />
                      ) : (
                        <div
                          className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarGradient(p.userId)} flex items-center justify-center text-white font-bold text-base border-2 border-white shadow-avatar`}
                        >
                          {getInitial(p)}
                        </div>
                      )}
                    </button>

                    {/* Info */}
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => setViewProfileId(p.userId)}
                    >
                      <p className="text-sm font-semibold text-slate-800 truncate">{getDisplayName(p)}</p>
                      {p.username && <p className="text-xs text-slate-400">@{p.username}</p>}
                      {p.bio && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{p.bio}</p>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {(p.followers ?? 0) > 0 && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            {p.followers} followers
                          </span>
                        )}
                        {dist !== undefined && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                            <MapPin size={9} /> {fmtDist(dist)}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setChatTarget(p)}
                        className="btn-icon w-8 h-8 rounded-lg text-indigo-500 hover:bg-indigo-50"
                        title="Chat"
                      >
                        <MessageCircle size={16} />
                      </button>
                      <div className="flex gap-1">
                        <button
                          onClick={() => initiateCall(p, 'audio')}
                          className="btn-icon w-8 h-8 rounded-lg text-slate-500 hover:text-violet-500 hover:bg-violet-50"
                          title="Audio call"
                        >
                          <Phone size={13} />
                        </button>
                        <button
                          onClick={() => initiateCall(p, 'video')}
                          className="btn-icon w-8 h-8 rounded-lg text-slate-500 hover:text-sky-500 hover:bg-sky-50"
                          title="Video call"
                        >
                          <Video size={13} />
                        </button>
                      </div>
                      <button
                        onClick={() => !isAdded && handleAddFriend(p.userId)}
                        disabled={isAdded || isAdding}
                        className={`btn-icon w-8 h-8 rounded-lg disabled:opacity-60 ${
                          isAdded
                            ? 'text-emerald-500 bg-emerald-50'
                            : 'text-slate-500 hover:text-emerald-500 hover:bg-emerald-50'
                        }`}
                        title={isAdded ? 'Friend' : 'Add friend'}
                      >
                        {isAdding
                          ? <span className="text-[10px]">…</span>
                          : isAdded
                            ? <UserCheck size={15} />
                            : <UserPlus size={15} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
