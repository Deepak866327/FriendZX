import React, { useState, useEffect, useCallback } from 'react';
import { Community } from '@/services/communityService';
import communityService from '@/services/communityService';
import { userService } from '@/services/userService';
import { useAuth } from '@/hooks/useAuth';
import { API_BASE_URL } from '@/utils/constants';
import { PublicProfile } from '@/types/api';

interface CommunityCardProps {
  community: Community;
  onUpdated: () => void;
  compact?: boolean;
  onClick?: () => void;
}

const resolveCover = (url?: string) =>
  !url ? null : url.startsWith('http') ? url : `${API_BASE_URL}/posts${url}`;

export const CommunityCard: React.FC<CommunityCardProps> = ({
  community, onUpdated, compact = false, onClick,
}) => {
  const { user } = useAuth();
  const isMember = community.members.includes(user?.id ?? '');
  const isAdmin  = community.adminId === user?.id;
  const [loading, setLoading] = useState(false);

  // Manage panel state
  const [showManage, setShowManage]         = useState(false);
  const [memberProfiles, setMemberProfiles] = useState<PublicProfile[]>([]);
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<PublicProfile[]>([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [actionLoading, setActionLoading]   = useState<string | null>(null);

  // Load member profiles when manage panel opens
  useEffect(() => {
    if (!showManage) return;
    let cancelled = false;
    Promise.all(
      community.members.map(id =>
        userService.getPublicProfile(id).catch(() => null)
      )
    ).then(profiles => {
      if (!cancelled) setMemberProfiles(profiles.filter(Boolean) as PublicProfile[]);
    });
    return () => { cancelled = true; };
  }, [showManage, community.members]);

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await userService.searchUsers(searchQuery.trim());
        // Exclude already-members
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
      onUpdated();
      setSearchQuery('');
      setSearchResults([]);
    } catch { /* silent */ }
    finally { setActionLoading(null); }
  }, [community.id, onUpdated]);

  const handleRemoveMember = useCallback(async (targetUserId: string) => {
    if (!window.confirm('Remove this member?')) return;
    setActionLoading(targetUserId);
    try {
      await communityService.removeMember(community.id, targetUserId);
      onUpdated();
      setMemberProfiles(prev => prev.filter(p => p.userId !== targetUserId));
    } catch { /* silent */ }
    finally { setActionLoading(null); }
  }, [community.id, onUpdated]);

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await communityService.join(community.id);
      onUpdated();
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const handleLeave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Leave "${community.name}"?`)) return;
    setLoading(true);
    try {
      await communityService.leave(community.id);
      onUpdated();
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const coverSrc = resolveCover(community.coverImage);

  const modeTag =
    community.mode === 'private' ? '🔒 Private' :
    community.visibility === 'nearby' ? `📍 Nearby · ${community.nearbyRadius ?? '?'} km` :
    '🌐 Public';

  if (compact) {
    return (
      <div className="community-card community-card--compact" onClick={onClick}>
        <div className="community-card__cover-sm">
          {coverSrc
            ? <img src={coverSrc} alt={community.name} />
            : <span>{community.name[0]?.toUpperCase()}</span>
          }
        </div>
        <div className="community-card__info">
          <div className="community-card__name">{community.name}</div>
          <div className="community-card__meta">{community.memberCount} members</div>
        </div>
        {isAdmin && <span className="community-card__admin-badge">Admin</span>}
      </div>
    );
  }

  return (
    <div className="community-card" onClick={onClick}>
      <div className="community-card__cover">
        {coverSrc
          ? <img src={coverSrc} alt={community.name} />
          : <div className="community-card__cover-placeholder">{community.name[0]?.toUpperCase()}</div>
        }
        <span className="community-card__mode-tag">{modeTag}</span>
      </div>
      <div className="community-card__body">
        <div className="community-card__name">{community.name}</div>
        {community.description && (
          <div className="community-card__desc">{community.description}</div>
        )}
        <div className="community-card__footer">
          <span className="community-card__members">{community.memberCount} members</span>
          {isAdmin ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <span className="community-card__admin-badge">Admin</span>
              <button
                className="btn btn-sm btn-outline"
                onClick={e => { e.stopPropagation(); setShowManage(v => !v); }}
              >
                👥 Manage
              </button>
            </div>
          ) : isMember ? (
            <button
              className="btn btn-sm btn-secondary"
              onClick={handleLeave}
              disabled={loading}
            >
              {loading ? '…' : 'Leave'}
            </button>
          ) : community.mode === 'public' ? (
            <button
              className="btn btn-sm btn-primary"
              onClick={handleJoin}
              disabled={loading}
            >
              {loading ? '…' : 'Join'}
            </button>
          ) : (
            <span className="community-card__invite-only">Invite only</span>
          )}
        </div>

        {/* ── Manage panel (admin only) ─────────────────────────────────── */}
        {showManage && isAdmin && (
          <div
            className="community-manage-panel"
            onClick={e => e.stopPropagation()}
          >
            <div className="community-manage-panel__section-label">Add Member</div>
            <div className="community-manage-panel__search">
              <input
                className="community-manage-panel__input"
                type="text"
                placeholder="Search by name…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchLoading && <span className="community-manage-panel__spinner" />}
            </div>

            {searchResults.length > 0 && (
              <ul className="community-manage-panel__results">
                {searchResults.map(p => (
                  <li key={p.userId} className="community-manage-panel__result-row">
                    <div className="community-manage-panel__avatar">
                      {p.firstName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span className="community-manage-panel__result-name">
                      {p.firstName} {p.lastName}
                    </span>
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ flexShrink: 0 }}
                      disabled={actionLoading === p.userId}
                      onClick={() => handleAddMember(p.userId)}
                    >
                      {actionLoading === p.userId ? '…' : '+ Add'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="community-manage-panel__section-label" style={{ marginTop: '12px' }}>
              Members ({community.memberCount})
            </div>
            {memberProfiles.length === 0 ? (
              <div className="community-manage-panel__empty">Loading…</div>
            ) : (
              <ul className="community-manage-panel__member-list">
                {memberProfiles.map(p => (
                  <li key={p.userId} className="community-manage-panel__member-row">
                    <div className="community-manage-panel__avatar">
                      {p.firstName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span className="community-manage-panel__member-name">
                      {p.firstName} {p.lastName}
                      {p.userId === community.adminId && (
                        <span className="community-manage-panel__admin-tag"> · Admin</span>
                      )}
                    </span>
                    {p.userId !== community.adminId && (
                      <button
                        className="btn btn-sm btn-secondary"
                        style={{ flexShrink: 0, fontSize: '11px' }}
                        disabled={actionLoading === p.userId}
                        onClick={() => handleRemoveMember(p.userId)}
                      >
                        {actionLoading === p.userId ? '…' : 'Remove'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
