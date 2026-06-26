import React, { useEffect, useRef, useState } from 'react';
import { Comment } from '@/services/postService';
import { userService } from '@/services/userService';
import { storage } from '@/utils/storage';

// Global event: when one comment sheet opens, all others close
const COMMENT_OPEN_EVENT = 'freindzx:comment:open';

interface Props {
  parentId: string;
  parentType: 'post' | 'cration';
  commentsCount: number;
  onCountChange?: (delta: number) => void;
  onClose: () => void;
  getComments: (id: string) => Promise<Comment[]>;
  addComment: (id: string, text: string) => Promise<Comment>;
  deleteComment: (parentId: string, commentId: string) => Promise<any>;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

export const CommentsModal: React.FC<Props> = ({
  parentId, parentType, commentsCount, onCountChange, onClose,
  getComments, addComment, deleteComment,
}) => {
  const me = storage.getUser()?.id || '';
  const [comments, setComments]       = useState<Comment[]>([]);
  const [names, setNames]             = useState<Record<string, string>>({});
  const [photos, setPhotos]           = useState<Record<string, string>>({});
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const inputRef  = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── On mount: broadcast "I am opening" so other sheets close ──────────────
  useEffect(() => {
    document.dispatchEvent(new CustomEvent(COMMENT_OPEN_EVENT, { detail: { id: parentId } }));

    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id && id !== parentId) onClose();
    };
    document.addEventListener(COMMENT_OPEN_EVENT, handler);
    return () => document.removeEventListener(COMMENT_OPEN_EVENT, handler);
  }, [parentId, onClose]);

  // ── Load comments ──────────────────────────────────────────────────────────
  useEffect(() => {
    getComments(parentId)
      .then(data => { setComments(data); fetchProfiles(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [parentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const fetchProfiles = async (list: Comment[]) => {
    const ids = [...new Set(list.map(c => c.userId).filter(id => !names[id]))];
    await Promise.allSettled(ids.map(async id => {
      try {
        const p = await userService.getPublicProfile(id);
        const name = p.firstName ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : id.slice(0, 8);
        setNames(prev => ({ ...prev, [id]: name }));
        if (p.photos?.[0]) setPhotos(prev => ({ ...prev, [id]: p.photos[0] }));
      } catch {}
    }));
  };

  // ── Add comment ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const c = await addComment(parentId, text);
      setComments(prev => [...prev, c]);
      onCountChange?.(1);
      setInput('');
      await fetchProfiles([c]);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || err?.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete comment ─────────────────────────────────────────────────────────
  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(parentId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      onCountChange?.(-1);
    } catch {}
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="comments-sheet-overlay"
      onClick={onClose}
    >
      <div
        className="comments-sheet"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="comments-sheet__handle" />

        {/* Header — X on left, title centered */}
        <div className="comments-sheet__header">
          <button
            className="comments-sheet__close"
            onClick={onClose}
          >
            ✕
          </button>
          <span className="comments-sheet__title">
            Comments
            {comments.length > 0 && (
              <span style={{ fontWeight: 400, fontSize: '13px', color: 'var(--ig-secondary)', marginLeft: '6px' }}>
                ({comments.length})
              </span>
            )}
          </span>
          {/* spacer to centre title */}
          <div style={{ width: 32 }} />
        </div>

        {/* Comments list */}
        <div className="comments-sheet__list">
          {loading
            ? <div className="loading" style={{ padding: '30px 0' }}><div className="loading-spinner" /></div>
            : comments.length === 0
              ? <div style={{ textAlign: 'center', color: 'var(--ig-secondary)', padding: '40px 0', fontSize: '14px' }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>💬</div>
                  <p style={{ margin: 0 }}>No comments yet. Be the first!</p>
                </div>
              : comments.map(c => {
                  const name  = names[c.userId] || c.userId.slice(0, 8) + '…';
                  const photo = photos[c.userId];
                  const isOwn = c.userId === me;
                  return (
                    <div key={c.id} className="comments-sheet__item">
                      <div className="comments-sheet__avatar">
                        {photo
                          ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--ig-secondary)' }}>{timeAgo(c.createdAt)}</span>
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: '14px', lineHeight: 1.4, wordBreak: 'break-word' }}>{c.text}</p>
                      </div>
                      {isOwn && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          title="Delete"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ig-secondary)', fontSize: '13px', opacity: 0.6, flexShrink: 0 }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  );
                })
          }
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="comments-sheet__input-row">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Add a comment…"
            className="comments-sheet__input"
            autoFocus
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || submitting}
            className="comments-sheet__post-btn"
            style={{ color: input.trim() ? 'var(--ig-blue)' : 'var(--ig-secondary)' }}
          >
            {submitting ? '…' : 'Post'}
          </button>
        </div>
        {submitError && (
          <p style={{ color: '#ef4444', fontSize: '12px', margin: '0 18px 8px', padding: 0 }}>{submitError}</p>
        )}
      </div>
    </div>
  );
};
