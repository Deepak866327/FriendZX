import React, { useEffect, useState, useCallback } from 'react';
import { PublicProfile } from '@/types/api';
import { useChatContext } from '@/context/ChatContext';
import { userService } from '@/services/userService';
import { chatService } from '@/services/chatService';
import { formatRelativeTime } from '@/utils/helpers';

interface ChatListProps {
  onSelectConversation: (profile: PublicProfile) => void;
}

export const ChatList: React.FC<ChatListProps> = ({ onSelectConversation }) => {
  const { conversations, fetchConversations } = useChatContext();
  const [profiles, setProfiles]         = useState<Record<string, PublicProfile>>({});
  const [isLoading, setIsLoading]       = useState(true);
  const [deleting, setDeleting]         = useState<string | null>(null);   // partnerId being deleted
  const [confirmId, setConfirmId]       = useState<string | null>(null);   // confirm prompt open

  useEffect(() => {
    fetchConversations().finally(() => setIsLoading(false));
  }, [fetchConversations]);

  // Fetch profiles for any conversation partners we don't have yet
  useEffect(() => {
    const missing = conversations.map(c => c.partnerId).filter(id => !profiles[id]);
    if (missing.length === 0) return;
    Promise.allSettled(missing.map(id => userService.getPublicProfile(id))).then(results => {
      const updates: Record<string, PublicProfile> = {};
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') updates[missing[i]] = result.value;
      });
      if (Object.keys(updates).length > 0) setProfiles(prev => ({ ...prev, ...updates }));
    });
  }, [conversations]);

  const getDisplayName = (partnerId: string) => {
    const p = profiles[partnerId];
    if (!p) return partnerId.slice(0, 10) + '…';
    return p.firstName ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : p.userId.slice(0, 10) + '…';
  };

  const getInitial = (partnerId: string) => {
    const p = profiles[partnerId];
    return (p?.firstName || partnerId).charAt(0).toUpperCase();
  };

  const handleDelete = useCallback(async (partnerId: string) => {
    setDeleting(partnerId);
    try {
      await chatService.deleteConversation(partnerId);
      await fetchConversations();    // refresh list from server
    } catch { /* silent */ }
    finally { setDeleting(null); setConfirmId(null); }
  }, [fetchConversations]);

  if (isLoading) {
    return (
      <div className="chat-list">
        <div className="chat-list-header"><h2>Messages</h2></div>
        <div className="loading" style={{ padding: '40px 0' }}><div className="loading-spinner" /></div>
      </div>
    );
  }

  return (
    <>
      <div className="chat-list">
        <div className="chat-list-header"><h2>Messages</h2></div>

        <div className="chat-list-items">
          {conversations.length === 0 ? (
            <div className="chat-empty-state">
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
              <p style={{ fontWeight: 600, margin: '0 0 4px' }}>No conversations yet</p>
              <p style={{ fontSize: '13px', color: 'var(--ig-secondary)', margin: 0 }}>Find people in Explore and start chatting</p>
            </div>
          ) : (
            conversations.map(convo => {
              const profile = profiles[convo.partnerId];
              const isDeleting = deleting === convo.partnerId;

              return (
                <div
                  key={convo.partnerId}
                  className="chat-list-item"
                  style={{ opacity: profile ? 1 : 0.6, position: 'relative' }}
                >
                  {/* Main row — click to open chat */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: profile ? 'pointer' : 'default' }}
                    onClick={() => profile && onSelectConversation(profile)}
                  >
                    <div className="conversation-avatar">
                      {profile?.photos?.[0]
                        ? <img src={profile.photos[0]} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : getInitial(convo.partnerId)}
                    </div>
                    <div className="conversation-content">
                      <div className="conversation-name">{getDisplayName(convo.partnerId)}</div>
                      <div className="conversation-last-message">{convo.lastMessage || 'No messages yet'}</div>
                    </div>
                    <div className="conversation-meta">
                      <small className="conversation-time">{formatRelativeTime(new Date(convo.lastMessageTime))}</small>
                      {(convo.unreadCount ?? 0) > 0 && (
                        <span className="unread-badge">{convo.unreadCount > 9 ? '9+' : convo.unreadCount}</span>
                      )}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    title="Delete conversation"
                    onClick={e => { e.stopPropagation(); setConfirmId(convo.partnerId); }}
                    disabled={isDeleting}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--ig-secondary)', fontSize: '16px',
                      padding: '8px', borderRadius: '8px',
                      opacity: isDeleting ? 0.4 : 0.6,
                      flexShrink: 0,
                      transition: 'opacity .15s, color .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ig-secondary)')}
                  >
                    {isDeleting ? '…' : '🗑️'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirmId && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setConfirmId(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)', borderRadius: '16px',
              padding: '24px', width: 'min(320px, 90vw)',
              boxShadow: '0 8px 32px rgba(0,0,0,.3)',
            }}
          >
            <div style={{ fontSize: '28px', textAlign: 'center', marginBottom: '12px' }}>🗑️</div>
            <h3 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: '16px' }}>Delete conversation?</h3>
            <p style={{ margin: '0 0 20px', textAlign: 'center', fontSize: '13px', color: 'var(--ig-secondary)' }}>
              This will permanently delete your chat history with <strong>{getDisplayName(confirmId)}</strong>. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setConfirmId(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmId)}
                className="btn"
                style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                disabled={deleting === confirmId}
              >
                {deleting === confirmId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
