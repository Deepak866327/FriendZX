import React, { useState, useEffect, useCallback } from 'react';
import { Globe, Lock, MapPin, Users, Settings, UserPlus, UserMinus, Search, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Community } from '@/services/communityService';
import communityService from '@/services/communityService';
import { userService } from '@/services/userService';
import { useAuth } from '@/hooks/useAuth';
import { API_BASE_URL } from '@/utils/constants';
import { PublicProfile } from '@/types/api';

interface Props {
  community: Community;
  onUpdated: () => void;
  compact?:  boolean;
  onClick?:  () => void;
}

const resolveCover = (url?: string) =>
  !url ? null : url.startsWith('http') ? url : `${API_BASE_URL}/posts${url}`;

const ModeTag: React.FC<{ community: Community }> = ({ community }) => {
  if (community.mode === 'private') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full glass-dark text-white text-[10px] font-semibold">
      <Lock size={9} /> Private
    </span>
  );
  if (community.visibility === 'nearby') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full glass-dark text-white text-[10px] font-semibold">
      <MapPin size={9} /> Nearby · {community.nearbyRadius ?? '?'} km
    </span>
  );
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full glass-dark text-white text-[10px] font-semibold">
      <Globe size={9} /> Public
    </span>
  );
};

const Avatar: React.FC<{ src?: string | null; name: string; size?: 'sm' | 'md' }> = ({ src, name, size = 'md' }) => {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${dim} rounded-xl flex-shrink-0 overflow-hidden bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold`}>
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}
    </div>
  );
};

export const CommunityCard: React.FC<Props> = ({ community, onUpdated, compact = false, onClick }) => {
  const { user }   = useAuth();
  const isMember   = community.members.includes(user?.id ?? '');
  const isAdmin    = community.adminId === user?.id;
  const [loading, setLoading]               = useState(false);
  const [showManage, setShowManage]         = useState(false);
  const [memberProfiles, setMemberProfiles] = useState<PublicProfile[]>([]);
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<PublicProfile[]>([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [actionLoading, setActionLoading]   = useState<string | null>(null);

  useEffect(() => {
    if (!showManage) return;
    let cancelled = false;
    Promise.all(community.members.map(id => userService.getPublicProfile(id).catch(() => null)))
      .then(profiles => { if (!cancelled) setMemberProfiles(profiles.filter(Boolean) as PublicProfile[]); });
    return () => { cancelled = true; };
  }, [showManage, community.members]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await userService.searchUsers(searchQuery.trim());
        setSearchResults(res.filter(p => !community.members.includes(p.userId)));
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, community.members]);

  const handleAddMember = useCallback(async (targetUserId: string) => {
    setActionLoading(targetUserId);
    try {
      await communityService.addMember(community.id, targetUserId);
      onUpdated(); setSearchQuery(''); setSearchResults([]);
    } catch {}
    finally { setActionLoading(null); }
  }, [community.id, onUpdated]);

  const handleRemoveMember = useCallback(async (targetUserId: string) => {
    if (!window.confirm('Remove this member?')) return;
    setActionLoading(targetUserId);
    try {
      await communityService.removeMember(community.id, targetUserId);
      onUpdated();
      setMemberProfiles(prev => prev.filter(p => p.userId !== targetUserId));
    } catch {}
    finally { setActionLoading(null); }
  }, [community.id, onUpdated]);

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation(); setLoading(true);
    try { await communityService.join(community.id); onUpdated(); }
    catch {} finally { setLoading(false); }
  };

  const handleLeave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Leave "${community.name}"?`)) return;
    setLoading(true);
    try { await communityService.leave(community.id); onUpdated(); }
    catch {} finally { setLoading(false); }
  };

  const coverSrc = resolveCover(community.coverImage);

  /* ── Compact variant ──────────────────────────────────────────── */
  if (compact) {
    return (
      <div
        className="flex items-center gap-2.5 glass-hover rounded-2xl p-3 cursor-pointer min-w-[140px]"
        onClick={onClick}
      >
        <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
          {coverSrc
            ? <img src={coverSrc} alt={community.name} className="w-full h-full object-cover" />
            : community.name[0]?.toUpperCase()
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{community.name}</p>
          <p className="text-xs text-slate-400">{community.memberCount} members</p>
        </div>
        {isAdmin && (
          <span className="px-1.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-600 text-[10px] font-bold flex-shrink-0">
            Admin
          </span>
        )}
      </div>
    );
  }

  /* ── Full card ────────────────────────────────────────────────── */
  return (
    <div className="glass-hover rounded-2xl overflow-hidden cursor-pointer" onClick={onClick}>
      {/* Cover */}
      <div className="relative h-28 bg-gradient-to-br from-indigo-400 via-violet-500 to-sky-400 flex-shrink-0">
        {coverSrc && (
          <img src={coverSrc} alt={community.name} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute top-2 right-2">
          <ModeTag community={community} />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-slate-800">{community.name}</p>
          {community.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{community.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Users size={12} />
            <span>{community.memberCount} members</span>
          </div>

          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {isAdmin ? (
              <>
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-[11px] font-bold">
                  <Crown size={10} /> Admin
                </span>
                <button
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass text-slate-600 text-xs font-semibold hover:bg-white/70 transition-colors"
                  onClick={e => { e.stopPropagation(); setShowManage(v => !v); }}
                >
                  <Settings size={12} /> Manage
                </button>
              </>
            ) : isMember ? (
              <button
                className="px-3 py-1.5 rounded-xl glass text-slate-600 text-xs font-semibold hover:bg-white/70 transition-colors disabled:opacity-50"
                onClick={handleLeave}
                disabled={loading}
              >
                {loading ? <span className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin inline-block" /> : 'Leave'}
              </button>
            ) : community.mode === 'public' ? (
              <button
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                onClick={handleJoin}
                disabled={loading}
              >
                {loading ? <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" /> : 'Join'}
              </button>
            ) : (
              <span className="text-xs text-slate-400 font-medium">Invite only</span>
            )}
          </div>
        </div>

        {/* ── Manage panel ──────────────────────────────────────── */}
        <AnimatePresence>
          {showManage && isAdmin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="pt-3 border-t border-white/30 space-y-3">
                {/* Add member search */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Add Member</p>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="input-glass w-full pl-8 text-sm"
                      style={{ borderRadius: '0.75rem' }}
                    />
                    {searchLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
                    )}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {searchResults.map(p => (
                        <div key={p.userId} className="flex items-center gap-2.5 px-3 py-2 glass rounded-xl">
                          <Avatar src={p.photos?.[0]} name={p.firstName || '?'} size="sm" />
                          <span className="flex-1 text-xs font-medium text-slate-700 truncate">
                            {p.firstName} {p.lastName}
                          </span>
                          <button
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white disabled:opacity-50 flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                            disabled={actionLoading === p.userId}
                            onClick={() => handleAddMember(p.userId)}
                          >
                            {actionLoading === p.userId
                              ? <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                              : <><UserPlus size={11} /> Add</>
                            }
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Member list */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Members ({community.memberCount})
                  </p>
                  {memberProfiles.length === 0 ? (
                    <div className="flex justify-center py-3">
                      <span className="w-4 h-4 rounded-full border-2 border-indigo-100 border-t-indigo-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {memberProfiles.map(p => (
                        <div key={p.userId} className="flex items-center gap-2.5 px-3 py-2 glass rounded-xl">
                          <Avatar src={p.photos?.[0]} name={p.firstName || '?'} size="sm" />
                          <span className="flex-1 text-xs font-medium text-slate-700 truncate">
                            {p.firstName} {p.lastName}
                            {p.userId === community.adminId && (
                              <span className="ml-1 text-indigo-500 font-semibold">· Admin</span>
                            )}
                          </span>
                          {p.userId !== community.adminId && (
                            <button
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 flex-shrink-0"
                              disabled={actionLoading === p.userId}
                              onClick={() => handleRemoveMember(p.userId)}
                            >
                              {actionLoading === p.userId
                                ? <span className="w-3 h-3 rounded-full border-2 border-rose-200 border-t-rose-500 animate-spin" />
                                : <><UserMinus size={11} /> Remove</>
                              }
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
