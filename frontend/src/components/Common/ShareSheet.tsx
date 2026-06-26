import React, { useEffect, useState } from 'react';
import { chatService } from '@/services/chatService';
import { userService } from '@/services/userService';
import { useSocket } from '@/context/SocketContext';
import { PublicProfile } from '@/types/api';
import { StoryCreator } from '@/components/Story/StoryCreator';

interface Props {
  /** What is being shared */
  type: 'post' | 'cration';
  id: string;
  text?: string;          // post content / cration caption
  mediaUrl?: string;      // first image (post) or video thumbnail (cration)
  mediaType?: 'image' | 'video';
  userLocation?: { latitude: number; longitude: number } | null;
  onShare?: () => void;   // called when share increments
  onClose: () => void;
}

export const ShareSheet: React.FC<Props> = ({
  type, id, text, mediaUrl, mediaType = 'image', userLocation, onShare, onClose,
}) => {
  const { emit } = useSocket();
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const [conversations, setConversations] = useState<{ partnerId: string; lastMessage: string }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());

  // ── External share ──────────────────────────────────────────────────────────
  const handleExternalShare = async () => {
    onShare?.();
    const shareData = {
      title: type === 'post' ? 'Check out this post' : 'Check out this cration',
      text: text || (type === 'post' ? 'Shared a post' : 'Shared a cration'),
      url: window.location.href,
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
    } else {
      await navigator.clipboard.writeText(shareData.url).catch(() => {});
      alert('Link copied to clipboard!');
    }
    onClose();
  };

  // ── Load conversations for friend picker ────────────────────────────────────
  const loadConversations = async () => {
    setLoadingConvos(true);
    try {
      const convos = await chatService.getConversations(30);
      setConversations(convos);
      // Fetch display names
      const ids = [...new Set(convos.map(c => c.partnerId))];
      await Promise.allSettled(ids.map(async id => {
        try {
          const p = await userService.getPublicProfile(id);
          setProfiles(prev => ({ ...prev, [id]: p }));
        } catch {}
      }));
    } catch {}
    setLoadingConvos(false);
  };

  useEffect(() => {
    if (showFriendPicker) loadConversations();
  }, [showFriendPicker]);

  // ── Send to friend via chat ─────────────────────────────────────────────────
  const sendToFriend = (partnerId: string) => {
    const label = type === 'post' ? '📸 Shared a post' : '🎬 Shared a cration';
    const preview = text ? `\n${text.slice(0, 80)}${text.length > 80 ? '…' : ''}` : '';
    emit('chat:send', { toUserId: partnerId, message: `${label}${preview}`, type: 'text' });
    setSent(prev => new Set(prev).add(partnerId));
    onShare?.();
  };

  const getDisplayName = (partnerId: string) => {
    const p = profiles[partnerId];
    return p?.firstName ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : partnerId.slice(0, 10) + '…';
  };

  // ── Story creator with pre-loaded media ─────────────────────────────────────
  if (showStoryCreator) {
    return (
      <StoryCreator
        userLocation={userLocation}
        initialMediaUrl={mediaUrl}
        initialMediaType={mediaType}
        onCreated={() => { setShowStoryCreator(false); onShare?.(); onClose(); }}
        onClose={() => setShowStoryCreator(false)}
      />
    );
  }

  // ── Friend picker ────────────────────────────────────────────────────────────
  if (showFriendPicker) {
    return (
      <div className="modal-overlay" onClick={() => setShowFriendPicker(false)}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '60vh', width: 'min(400px, 95vw)', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontWeight: 700, fontSize: '16px' }}>Send to friend</span>
            <button onClick={() => setShowFriendPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--ig-secondary)' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingConvos
              ? <div className="loading" style={{ padding: '30px 0' }}><div className="loading-spinner" /></div>
              : conversations.length === 0
                ? <p style={{ textAlign: 'center', color: 'var(--ig-secondary)', padding: '40px 16px', margin: 0 }}>No conversations yet</p>
                : conversations.map(c => {
                    const isSent = sent.has(c.partnerId);
                    const p = profiles[c.partnerId];
                    return (
                      <div key={c.partnerId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--ig-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: '16px', flexShrink: 0, overflow: 'hidden' }}>
                          {p?.photos?.[0] ? <img src={p.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getDisplayName(c.partnerId).charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{getDisplayName(c.partnerId)}</div>
                        </div>
                        <button
                          onClick={() => sendToFriend(c.partnerId)}
                          disabled={isSent}
                          style={{ background: isSent ? 'var(--card-2)' : 'var(--ig-blue)', color: isSent ? 'var(--ig-secondary)' : '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 700, cursor: isSent ? 'default' : 'pointer' }}
                        >
                          {isSent ? '✓ Sent' : 'Send'}
                        </button>
                      </div>
                    );
                  })
            }
          </div>
          <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setShowFriendPicker(false); onClose(); }}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main share options ───────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="share-sheet"
        onClick={e => e.stopPropagation()}
      >
        <div className="share-sheet__handle" />
        <div className="share-sheet__title">Share</div>

        <div className="share-sheet__options">
          {/* External share */}
          <button className="share-sheet__option" onClick={handleExternalShare}>
            <div className="share-sheet__option-icon">📤</div>
            <span className="share-sheet__option-label">Share</span>
          </button>

          {/* Send to friend */}
          <button className="share-sheet__option" onClick={() => setShowFriendPicker(true)}>
            <div className="share-sheet__option-icon">💬</div>
            <span className="share-sheet__option-label">Send to friend</span>
          </button>

          {/* Add to story */}
          {mediaUrl && (
            <button className="share-sheet__option" onClick={() => setShowStoryCreator(true)}>
              <div className="share-sheet__option-icon">➕</div>
              <span className="share-sheet__option-label">Add to story</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
