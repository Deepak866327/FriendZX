import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { formatDistance } from '@/utils/helpers';
import { PublicProfile } from '@/types/api';
import { userService } from '@/services/userService';
import { ChatModal } from '@/components/Chat/ChatModal';
import { UserProfileModal } from '@/components/Profile/UserProfileModal';
import { useCallContext } from '@/context/CallContext';

export const NearbyUsers: React.FC = () => {
  const { nearbyUsers, getNearbyUsers, isLoading } = useLocation();
  const { initiateCall } = useCallContext();
  const [profiles,      setProfiles]      = useState<Record<string, PublicProfile>>({});
  const [addedFriends,  setAddedFriends]  = useState<Set<string>>(new Set());
  const [chatTarget,    setChatTarget]    = useState<PublicProfile | null>(null);
  const [addingId,      setAddingId]      = useState<string | null>(null);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  useEffect(() => {
    getNearbyUsers();
    const interval = setInterval(() => getNearbyUsers(), 60000);
    return () => clearInterval(interval);
  }, [getNearbyUsers]);

  // Fetch profiles for each nearby user
  useEffect(() => {
    nearbyUsers.forEach(u => {
      if (!profiles[u.userId]) {
        userService.getPublicProfile(u.userId)
          .then(p => setProfiles(prev => ({ ...prev, [u.userId]: p })))
          .catch(() => {
            // Fallback profile with just userId
            setProfiles(prev => ({
              ...prev,
              [u.userId]: {
                userId: u.userId,
                interests: [],
                photos: [],
                followers: 0,
                following: 0,
              },
            }));
          });
      }
    });
  }, [nearbyUsers]);

  const handleAddFriend = useCallback(async (userId: string) => {
    setAddingId(userId);
    try {
      await userService.addFriend(userId);
      setAddedFriends(prev => new Set(prev).add(userId));
    } catch (err: any) {
      if (err?.response?.data?.error?.includes('Already following')) {
        setAddedFriends(prev => new Set(prev).add(userId));
      }
    } finally {
      setAddingId(null);
    }
  }, []);

  const getDisplayName = (profile: PublicProfile) => {
    if (profile.firstName) {
      return `${profile.firstName}${profile.lastName ? ' ' + profile.lastName : ''}`;
    }
    return profile.userId.slice(0, 10) + '…';
  };

  const getInitial = (profile: PublicProfile) =>
    (profile.firstName || profile.userId).charAt(0).toUpperCase();

  return (
    <>
      <div className="nearby-users">
        <h2>Nearby Users</h2>

        {isLoading && nearbyUsers.length === 0 ? (
          <div className="loading"><div className="loading-spinner"></div></div>
        ) : nearbyUsers.length === 0 ? (
          <p className="empty">No nearby users found. Start tracking to discover people around you.</p>
        ) : (
          <div className="users-grid">
            {nearbyUsers.map(u => {
              const profile = profiles[u.userId];
              const isFriend = addedFriends.has(u.userId);
              const isAdding = addingId === u.userId;

              return (
                <div key={u.userId} className="user-card">
                  {/* Avatar — click to view profile */}
                  <div
                    className="user-card-avatar"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setViewProfileId(u.userId)}
                    title="View profile"
                  >
                    {profile?.photos?.[0] ? (
                      <img
                        src={profile.photos[0]}
                        alt=""
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      profile ? getInitial(profile) : u.userId.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Info — click to view profile */}
                  <div
                    className="user-info"
                    style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                    onClick={() => setViewProfileId(u.userId)}
                  >
                    <h3>{profile ? getDisplayName(profile) : u.userId.slice(0, 10) + '…'}</h3>
                    <p className="distance">📍 {formatDistance(u.distance)}</p>
                    {profile?.bio && (
                      <p style={{ fontSize: '11px', color: 'var(--ig-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {profile.bio}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => profile && setChatTarget(profile)}
                      disabled={!profile}
                    >
                      💬 Chat
                    </button>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => profile && initiateCall(profile, 'audio')}
                        disabled={!profile}
                        title="Audio call"
                      >
                        📞
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => profile && initiateCall(profile, 'video')}
                        disabled={!profile}
                        title="Video call"
                      >
                        📹
                      </button>
                    </div>
                    <button
                      className={`btn btn-sm ${isFriend ? 'btn-secondary' : 'btn-outline'}`}
                      onClick={() => !isFriend && handleAddFriend(u.userId)}
                      disabled={isFriend || isAdding}
                    >
                      {isAdding ? '…' : isFriend ? '✓ Friend' : '+ Add'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
