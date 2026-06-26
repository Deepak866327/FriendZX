import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useCallContext } from '@/context/CallContext';
import { userService } from '@/services/userService';
import { PublicProfile } from '@/types/api';
import { ChatModal } from '@/components/Chat/ChatModal';

// Build a minimal profile from notification data (enough for calls / chat)
function profileFromNotif(fromUserId: string, fromName: string, photo?: string): PublicProfile {
  const parts = fromName.trim().split(' ');
  return {
    userId: fromUserId,
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || undefined,
    interests: [],
    photos: photo ? [photo] : [],
    followers: 0,
    following: 0,
  };
}

export const NotificationBell: React.FC = () => {
  const { unreadCount, notifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { incomingRequest, approveRequest, denyRequest, initiateCall } = useCallContext();
  const [isOpen, setIsOpen] = useState(false);
  const [addedBack, setAddedBack] = useState<Set<string>>(new Set());
  const [chatTarget, setChatTarget] = useState<PublicProfile | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-open bell when a call request arrives
  useEffect(() => {
    if (incomingRequest) setIsOpen(true);
  }, [incomingRequest]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleOpen = () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening && unreadCount > 0) markAllAsRead();
  };

  const handleAddBack = async (fromUserId: string, notifId: string) => {
    try {
      await userService.addFriend(fromUserId);
      setAddedBack(prev => new Set(prev).add(fromUserId));
      markAsRead(notifId);
    } catch (_) {}
  };

  const handleChat = async (fromUserId: string, fromName: string, notifId: string) => {
    try {
      const profile = await userService.getPublicProfile(fromUserId);
      setChatTarget(profile);
    } catch (_) {
      setChatTarget(profileFromNotif(fromUserId, fromName));
    }
    markAsRead(notifId);
    setIsOpen(false);
  };

  const handleCall = async (fromUserId: string, fromName: string, type: 'audio' | 'video', notifId: string) => {
    let profile: PublicProfile;
    try {
      profile = await userService.getPublicProfile(fromUserId);
    } catch (_) {
      profile = profileFromNotif(fromUserId, fromName);
    }
    markAsRead(notifId);
    setIsOpen(false);
    initiateCall(profile, type);
  };

  const handleDelete = (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    deleteNotification(notifId);
  };

  const formatTime = (d: Date) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const iconFor = (type: string) => {
    if (type === 'chat') return '💬';
    if (type === 'nearby_user_found') return '📍';
    if (type === 'user_registered') return '🎉';
    return '🔔';
  };

  const avatarStyle = (color = 'var(--ig-gradient)'): React.CSSProperties => ({
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    background: color, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'white',
    overflow: 'hidden',
  });

  return (
    <>
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <button className="nav-icon-btn" onClick={handleOpen} style={{ position: 'relative' }} title="Notifications">
          🔔
          {(unreadCount > 0 || incomingRequest) && (
            <span style={{
              position: 'absolute', top: 0, right: 0,
              background: incomingRequest ? '#0095f6' : '#ed4956', color: 'white',
              borderRadius: '50%', fontSize: '10px', fontWeight: 700,
              minWidth: '16px', height: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px', lineHeight: 1, pointerEvents: 'none',
            }}>
              {incomingRequest ? '📞' : unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 340, maxHeight: 480, overflowY: 'auto',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
            zIndex: 1000,
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1,
            }}>
              <span style={{ fontWeight: 700, fontSize: '16px' }}>Notifications</span>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--ig-secondary)', lineHeight: 1 }}>✕</button>
            </div>

            {/* Incoming call request */}
            {incomingRequest && (
              <div className="call-request-notification" style={{ margin: '10px 12px 0', borderRadius: '10px' }}>
                <div className="call-request-avatar">{incomingRequest.fromName.charAt(0).toUpperCase()}</div>
                <div className="call-request-info">
                  <p className="call-request-name">{incomingRequest.fromName}</p>
                  <p className="call-request-text">wants to {incomingRequest.callType === 'video' ? '📹 video' : '📞 audio'} call you</p>
                </div>
                <div className="call-request-actions">
                  <button className="call-req-btn call-req-deny" onClick={denyRequest}>Deny</button>
                  <button className="call-req-btn call-req-allow" onClick={approveRequest}>Allow</button>
                </div>
              </div>
            )}

            {notifications.length === 0 && !incomingRequest ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ig-secondary)', fontSize: '14px' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔔</div>
                <p style={{ margin: 0 }}>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 20).map(n => {
                const isFollowNotif = n.type === 'user_followed' && n.data?.fromUserId;
                const fromName = n.data?.fromName || n.title;
                const fromInitial = (fromName || '?').charAt(0).toUpperCase();

                return (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markAsRead(n.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: n.read ? 'transparent' : 'rgba(0,149,246,0.05)',
                      cursor: n.read ? 'default' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* ── Follow notification: suggestion card ────────── */}
                    {isFollowNotif ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* Avatar with follower's initial */}
                          <div style={avatarStyle()}>{fromInitial}</div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: n.read ? 500 : 700, fontSize: '13px' }}>
                              {n.title}
                              {!n.read && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--ig-blue)', marginLeft: '6px', verticalAlign: 'middle' }} />}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--ig-secondary)', marginTop: '1px' }}>{formatTime(n.createdAt)}</div>
                          </div>

                          <button onClick={(e) => handleDelete(e, n.id)} title="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ig-secondary)', fontSize: '12px', opacity: 0.6 }}>✕</button>
                        </div>

                        {/* Action buttons row */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', marginLeft: '46px' }}>
                          {/* Add Back / Added */}
                          {addedBack.has(n.data!.fromUserId) ? (
                            <span style={{ fontSize: '12px', color: 'var(--ig-secondary)', alignSelf: 'center' }}>✓ Added</span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAddBack(n.data!.fromUserId, n.id); }}
                              style={{ background: 'var(--ig-blue)', color: 'white', border: 'none', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              + Add Back
                            </button>
                          )}

                          {/* Audio call */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCall(n.data!.fromUserId, fromName, 'audio', n.id); }}
                            title="Audio call"
                            style={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
                          >📞</button>

                          {/* Video call */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCall(n.data!.fromUserId, fromName, 'video', n.id); }}
                            title="Video call"
                            style={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
                          >📹</button>

                          {/* Message */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleChat(n.data!.fromUserId, fromName, n.id); }}
                            title="Send message"
                            style={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 10px', fontSize: '14px', cursor: 'pointer' }}
                          >💬</button>
                        </div>
                      </div>
                    ) : (
                      /* ── All other notifications ─────────────────────── */
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={avatarStyle(n.type === 'chat' ? 'var(--ig-blue)' : 'var(--ig-gradient)')}>
                          {iconFor(n.type)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ fontWeight: n.read ? 500 : 700, fontSize: '13px', marginBottom: '2px' }}>
                              {n.title}
                              {!n.read && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--ig-blue)', marginLeft: '6px', verticalAlign: 'middle' }} />}
                            </div>
                            <button onClick={(e) => handleDelete(e, n.id)} title="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ig-secondary)', fontSize: '12px', padding: '0 2px', lineHeight: 1, flexShrink: 0, opacity: 0.6 }}>✕</button>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--ig-secondary)', marginBottom: '4px', lineHeight: 1.4 }}>{n.message}</div>
                          <div style={{ fontSize: '11px', color: 'var(--ig-secondary)', opacity: 0.7 }}>{formatTime(n.createdAt)}</div>

                          {/* Chat notification action */}
                          {n.type === 'chat' && n.data?.fromUserId && (
                            <div style={{ marginTop: '8px' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleChat(n.data!.fromUserId, n.data!.fromName || '', n.id); }}
                                style={{ background: 'var(--ig-blue)', color: 'white', border: 'none', borderRadius: '8px', padding: '5px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Open Chat
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {chatTarget && (
        <ChatModal targetUser={chatTarget} onClose={() => setChatTarget(null)} />
      )}
    </>
  );
};
