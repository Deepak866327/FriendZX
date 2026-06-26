import React, { useEffect, useState, useCallback } from 'react';
import { PublicProfile } from '@/types/api';
import { userService } from '@/services/userService';
import { ChatModal } from '@/components/Chat/ChatModal';

interface FollowListModalProps {
  type: 'followers' | 'following';
  onClose: () => void;
}

export const FollowListModal: React.FC<FollowListModalProps> = ({ type, onClose }) => {
  const [list, setList] = useState<PublicProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // IDs the current user is already following back (loaded on mount for followers tab)
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  // IDs added back during this session
  const [addedBackIds, setAddedBackIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // IDs removed/unfriended during this session — hidden from the list
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [chatTarget, setChatTarget] = useState<PublicProfile | null>(null);

  useEffect(() => {
    if (type === 'followers') {
      Promise.all([userService.getFollowers(), userService.getFollowing()])
        .then(([followers, following]) => {
          setList(followers);
          setFollowingSet(new Set(following.map(f => f.userId)));
        })
        .catch(() => setList([]))
        .finally(() => setIsLoading(false));
    } else {
      userService.getFollowing()
        .then(setList)
        .catch(() => setList([]))
        .finally(() => setIsLoading(false));
    }
  }, [type]);

  const handleAddBack = useCallback(async (userId: string) => {
    setAddingId(userId);
    try {
      await userService.addFriend(userId);
      setAddedBackIds(prev => new Set(prev).add(userId));
    } catch (err: any) {
      if (err?.response?.data?.error?.includes('Already following')) {
        setAddedBackIds(prev => new Set(prev).add(userId));
      }
    } finally {
      setAddingId(null);
    }
  }, []);

  const handleUnfollow = useCallback(async (userId: string) => {
    setRemovingId(userId);
    try {
      await userService.removeFollower(userId);
      setRemovedIds(prev => new Set(prev).add(userId));
    } catch {
      // leave in list on error
    } finally {
      setRemovingId(null);
    }
  }, []);

  const handleUnfriend = useCallback(async (userId: string) => {
    setRemovingId(userId);
    try {
      await userService.unfollowUser(userId);
      setRemovedIds(prev => new Set(prev).add(userId));
    } catch {
      // leave in list on error
    } finally {
      setRemovingId(null);
    }
  }, []);

  const getDisplayName = (p: PublicProfile) =>
    p.firstName ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : p.userId.slice(0, 10) + '…';

  const getInitial = (p: PublicProfile) =>
    (p.firstName || p.userId).charAt(0).toUpperCase();

  const title = type === 'followers' ? 'Followers' : 'Friends';
  const visibleList = list.filter(p => !removedIds.has(p.userId));

  if (chatTarget) {
    return <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-small"
        onClick={e => e.stopPropagation()}
        style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--ig-border)',
        }}>
          <span style={{ fontWeight: 700, fontSize: '16px' }}>{title}</span>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div className="loading" style={{ padding: '40px 0' }}>
              <div className="loading-spinner" />
            </div>
          ) : visibleList.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ig-secondary)', fontSize: '14px' }}>
              No {title.toLowerCase()} yet.
            </div>
          ) : (
            visibleList.map(p => {
              const isRemoving = removingId === p.userId;
              const isAdding = addingId === p.userId;
              const isFriend = followingSet.has(p.userId) || addedBackIds.has(p.userId);

              return (
                <div key={p.userId} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 16px', borderBottom: '1px solid var(--ig-border)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--ig-gradient)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: '16px',
                    overflow: 'hidden',
                  }}>
                    {p.photos?.[0]
                      ? <img src={p.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : getInitial(p)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{getDisplayName(p)}</div>
                    {p.bio && (
                      <div style={{ fontSize: '12px', color: 'var(--ig-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.bio}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                      onClick={() => setChatTarget(p)}
                    >
                      💬 Chat
                    </button>

                    {type === 'followers' ? (
                      <>
                        {/* Unfollow = remove this person from your followers */}
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: '12px', padding: '4px 10px', color: 'var(--ig-danger, #ed4956)', borderColor: 'var(--ig-danger, #ed4956)' }}
                          disabled={isRemoving}
                          onClick={() => handleUnfollow(p.userId)}
                        >
                          {isRemoving ? '…' : 'Unfollow'}
                        </button>

                        {/* Friend status / Add Back */}
                        {isFriend ? (
                          <span style={{
                            fontSize: '12px', padding: '4px 10px',
                            border: '1px solid var(--ig-border)', borderRadius: '6px',
                            color: 'var(--ig-secondary)', display: 'flex', alignItems: 'center',
                          }}>
                            ✓ Friend
                          </span>
                        ) : (
                          <button
                            className="btn btn-sm btn-outline"
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                            disabled={isAdding}
                            onClick={() => handleAddBack(p.userId)}
                          >
                            {isAdding ? '…' : '+ Add Back'}
                          </button>
                        )}
                      </>
                    ) : (
                      /* Following tab: only Unfriend */
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ fontSize: '12px', padding: '4px 10px', color: 'var(--ig-danger, #ed4956)', borderColor: 'var(--ig-danger, #ed4956)' }}
                        disabled={isRemoving}
                        onClick={() => handleUnfriend(p.userId)}
                      >
                        {isRemoving ? '…' : 'Unfriend'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
