import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChatMessage, PublicProfile } from '@/types/api';
import { chatService } from '@/services/chatService';
import { useSocket } from '@/context/SocketContext';
import { useChatContext } from '@/context/ChatContext';
import { useCallContext } from '@/context/CallContext';
import { storage } from '@/utils/storage';
import {
  getOrCreateKeyPair, getPublicKeyJwk, importPublicKey,
  deriveSharedKey, encryptMessage, decryptMessage,
} from '@/utils/chatCrypto';
import challengeService from '@/services/challengeService';
import { FriendChallengeModal } from '@/components/Challenge/FriendChallengeModal';

// ── Challenge helpers ──────────────────────────────────────────────────────
const CHALLENGE_TYPES = [
  { key: 'math', icon: '🔢', label: 'Maths' },
];
const CHALLENGE_PREFIX = '⚡challenge:';
function encodeChallengeMsg(id: string, type: string, label: string, icon: string) {
  return `${CHALLENGE_PREFIX}${JSON.stringify({ id, type, label, icon })}`;
}
function parseChallengeMsg(msg: string) {
  if (!msg.startsWith(CHALLENGE_PREFIX)) return null;
  try { return JSON.parse(msg.slice(CHALLENGE_PREFIX.length)) as { id: string; type: string; label: string; icon: string }; }
  catch { return null; }
}

const API_BASE = '/api';
function resolveUrl(url: string) { return url.startsWith('http') ? url : `${API_BASE}${url}`; }
function fmtDur(s: number) { return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`; }
function fmt(ts: string) { try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } }

// Get video duration before upload
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(vid.duration); };
    vid.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Invalid video')); };
    vid.src = url;
  });
}

interface PendingAttachment {
  file: File;
  preview?: string;          // blob URL for thumbnail
  type: 'image' | 'video';
  durationLabel?: string;    // e.g. "0:18"
  error?: string;
}

interface Props { targetUser: PublicProfile; onClose: () => void; }

export const ChatModal: React.FC<Props> = ({ targetUser, onClose }) => {
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(true);
  const [e2eeReady, setE2eeReady]   = useState(false);
  const e2eeKeyRef = useRef<CryptoKey | null>(null);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);

  // Attachment
  const [pendingAtt, setPendingAtt]   = useState<PendingAttachment | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadPct, setUploadPct]     = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice
  const [recording, setRecording]   = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [voiceBlob, setVoiceBlob]   = useState<Blob | null>(null);
  const mediaRecRef    = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval>>();
  const chunksRef      = useRef<BlobPart[]>([]);

  // Once-view: track viewed IDs + cached blob URLs (so image stays visible after server deletion)
  const [viewedOnce, setViewedOnce]         = useState<Set<string>>(new Set());
  const [viewedBlobUrls, setViewedBlobUrls] = useState<Record<string, string>>({});
  const [loadingView, setLoadingView]       = useState<Set<string>>(new Set());

  // Challenge
  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [selectedType, setSelectedType]     = useState('math');
  const [challengeCreating, setChallengeCreating] = useState(false);
  const [challengeError, setChallengeError]       = useState('');
  const [openChallengeId, setOpenChallengeId]     = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const { on, off, emit, isConnected } = useSocket();
  const { markRead, setActiveChatPartner } = useChatContext();
  const { initiateCall } = useCallContext();
  const me = storage.getUser()?.id || '';

  const displayName = targetUser.firstName
    ? `${targetUser.firstName} ${targetUser.lastName || ''}`.trim()
    : targetUser.userId.slice(0, 8);
  const avatarInitial = (targetUser.firstName || targetUser.userId).charAt(0).toUpperCase();

  // ── tryDecrypt (uses ref — no stale closure) ───────────────────────────────
  const tryDecrypt = useCallback(async (msg: ChatMessage): Promise<ChatMessage> => {
    if (msg.encrypted && msg.iv) {
      const key = e2eeKeyRef.current;
      if (key) {
        try { return { ...msg, _decrypted: await decryptMessage(key, msg.message, msg.iv) }; }
        catch {}
      }
    }
    return msg;
  }, []);

  // ── E2EE init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const pair = await getOrCreateKeyPair();
        await chatService.storePublicKey(await getPublicKeyJwk());
        const theirJwk = await chatService.getPublicKey(targetUser.userId);
        if (theirJwk) {
          const theirPub = await importPublicKey(theirJwk);
          const key = await deriveSharedKey(pair.privateKey, theirPub);
          e2eeKeyRef.current = key;
          setE2eeReady(true);
        }
      } catch {}
    })();
  }, [targetUser.userId]);

  // Re-decrypt when key becomes available
  useEffect(() => {
    if (!e2eeReady || messages.length === 0) return;
    (async () => {
      setMessages(await Promise.all(messages.map(tryDecrypt)));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e2eeReady]);

  // ── Load history ───────────────────────────────────────────────────────────
  useEffect(() => {
    chatService.getChatHistory(targetUser.userId)
      .then(async msgs => setMessages(await Promise.all(msgs.map(tryDecrypt))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [targetUser.userId, tryDecrypt]);

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    markRead(targetUser.userId);
    setActiveChatPartner(targetUser.userId);
    const onIn  = async (m: ChatMessage) => {
      if (m.fromUserId !== targetUser.userId) return;
      const dec = await tryDecrypt({ ...m, type: m.type || 'text' as const });
      setMessages(p => [...p, dec]);
    };
    const onOut = async (m: ChatMessage) => {
      if (m.toUserId !== targetUser.userId) return;
      const dec = await tryDecrypt({ ...m, type: m.type || 'text' as const });
      setMessages(p => [...p, dec]);
    };
    const onDeleted = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted: true, message: '', _decrypted: undefined } : m));
    };

    on('chat:message', onIn);
    on('chat:message:sent', onOut);
    on('chat:message:deleted', onDeleted);
    return () => {
      off('chat:message', onIn);
      off('chat:message:sent', onOut);
      off('chat:message:deleted', onDeleted);
      setActiveChatPartner(null);
    };
  }, [targetUser.userId, on, off, markRead, setActiveChatPartner, tryDecrypt]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Send text ──────────────────────────────────────────────────────────────
  const sendText = useCallback(async (text?: string) => {
    const raw = (text ?? input).trim();
    if (!raw) return;
    if (!text) setInput('');
    const key = e2eeKeyRef.current;
    if (key) {
      try {
        const { ciphertext, iv } = await encryptMessage(key, raw);
        emit('chat:send', { toUserId: targetUser.userId, message: ciphertext, iv, encrypted: true, type: 'text' });
        return;
      } catch {}
    }
    emit('chat:send', { toUserId: targetUser.userId, message: raw, type: 'text' });
  }, [input, targetUser.userId, emit]);

  // ── Delete a message (own messages only) ─────────────────────────────────
  const handleDeleteMessage = useCallback((msgId: string) => {
    emit('chat:delete', { messageId: msgId, toUserId: targetUser.userId });
    // Optimistic update — server confirms via chat:message:deleted
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true, message: '', _decrypted: undefined } : m));
    setSelectedMsgId(null);
  }, [emit, targetUser.userId]);

  // ── File selected: validate + preview ─────────────────────────────────────
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const preview = URL.createObjectURL(file);
      setPendingAtt({ file, preview, type: 'image' });
      return;
    }

    if (file.type.startsWith('video/')) {
      try {
        const duration = await getVideoDuration(file);
        if (duration > 30) {
          setPendingAtt({ file, type: 'video', error: `Video is ${Math.round(duration)}s — maximum is 30 seconds` });
          return;
        }
        const preview = URL.createObjectURL(file);
        setPendingAtt({ file, preview, type: 'video', durationLabel: fmtDur(duration) });
      } catch {
        setPendingAtt({ file, type: 'video', error: 'Could not read video' });
      }
      return;
    }

    // Non-image/video: show error
    setPendingAtt({ file, type: 'image', error: 'Only images and videos can be sent' });
  };

  const sendAttachment = async () => {
    if (!pendingAtt || pendingAtt.error) return;
    setUploading(true); setUploadPct(0);
    try {
      const att = await chatService.uploadAttachment(pendingAtt.file, pendingAtt.type, pendingAtt.file.name, setUploadPct);
      emit('chat:send', { toUserId: targetUser.userId, message: '', type: pendingAtt.type, attachment: att });
      if (pendingAtt.preview) URL.revokeObjectURL(pendingAtt.preview);
      setPendingAtt(null);
    } catch { /* silent */ }
    finally { setUploading(false); setUploadPct(0); }
  };

  // ── Voice ──────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); setVoiceBlob(new Blob(chunksRef.current, { type: mime })); };
      mr.start(200);
      mediaRecRef.current = mr;
      setRecording(true); setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch { alert('Microphone permission denied'); }
  };
  const stopRecording = () => { mediaRecRef.current?.stop(); mediaRecRef.current = null; clearInterval(recordTimerRef.current); setRecording(false); };
  const cancelVoice = () => { setVoiceBlob(null); setRecordSecs(0); };
  const sendVoice = async () => {
    if (!voiceBlob) return;
    const dur = recordSecs;
    setUploading(true);
    try {
      const ext = voiceBlob.type.includes('webm') ? '.webm' : '.mp4';
      const att = await chatService.uploadAttachment(voiceBlob, 'voice', `voice${ext}`, setUploadPct);
      emit('chat:send', { toUserId: targetUser.userId, message: '', type: 'voice', attachment: { ...att, duration: dur } });
      setVoiceBlob(null); setRecordSecs(0);
    } catch {}
    finally { setUploading(false); setUploadPct(0); }
  };

  // ── Challenge ──────────────────────────────────────────────────────────────
  const handleCreateChallenge = async () => {
    setChallengeCreating(true);
    setChallengeError('');
    try {
      const { id } = await challengeService.createFriendChallenge(targetUser.userId, selectedType);
      const t = CHALLENGE_TYPES.find(x => x.key === selectedType)!;
      // Challenge messages must not be E2EE-encrypted so both sides can parse the card
      emit('chat:send', { toUserId: targetUser.userId, message: encodeChallengeMsg(id, selectedType, t.label, t.icon), type: 'text' });
      setShowChallengePicker(false);
    } catch (err: any) {
      setChallengeError(err?.response?.data?.error || err?.message || 'Failed to create challenge');
    } finally {
      setChallengeCreating(false);
    }
  };

  // ── Tap to view (once-view image/video) ────────────────────────────────────
  // Fetch → store as blob URL (stays visible after server deletion) → delete from server
  const handleTapToView = async (msg: ChatMessage) => {
    if (!msg.attachment) return;
    const { attachmentId, url } = msg.attachment;
    if (viewedOnce.has(attachmentId) || loadingView.has(attachmentId)) return;

    setLoadingView(prev => new Set(prev).add(attachmentId));
    try {
      const response = await fetch(resolveUrl(url));
      if (!response.ok) throw new Error('Gone');
      const blob    = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setViewedBlobUrls(prev => ({ ...prev, [attachmentId]: blobUrl }));
      setViewedOnce(prev => new Set(prev).add(attachmentId));
      // Server deletes file after serving (once-view logic in backend)
    } catch {
      // File already deleted or expired
      setViewedOnce(prev => new Set(prev).add(attachmentId));
    } finally {
      setLoadingView(prev => { const s = new Set(prev); s.delete(attachmentId); return s; });
    }
  };

  const isMe = (m: ChatMessage) => m.fromUserId === me;

  // ── Message renderer ───────────────────────────────────────────────────────
  const renderMsg = (msg: ChatMessage) => {
    const mine = isMe(msg);
    const bg     = mine ? 'var(--ig-blue)' : 'var(--card-2)';
    const fg     = mine ? '#fff' : 'var(--text)';
    const radius = mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px';
    const isSelected = selectedMsgId === msg.id;

    // ── Deleted message ──────────────────────────────────────────────────────
    if (msg.deleted) {
      return (
        <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
          <div style={{ padding: '7px 12px', borderRadius: radius, border: '1px solid var(--border)', color: 'var(--ig-secondary)', fontSize: '13px', fontStyle: 'italic', maxWidth: '72%' }}>
            🚫 This message was deleted
          </div>
        </div>
      );
    }

    const bubble = (children: React.ReactNode, extra: React.CSSProperties = {}) => (
      <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <div
          style={{ maxWidth: '72%', borderRadius: radius, background: bg, color: fg, border: mine ? 'none' : '1px solid var(--border)', fontSize: '14px', lineHeight: 1.4, cursor: mine ? 'pointer' : 'default', ...extra }}
          onClick={mine ? (e) => { e.stopPropagation(); setSelectedMsgId(prev => prev === msg.id ? null : msg.id); } : undefined}
        >
          {children}
        </div>
        {/* Delete option — appears when this message is selected */}
        {isSelected && mine && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id); }}
            style={{
              marginTop: '4px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
              color: '#ef4444', borderRadius: '8px', padding: '4px 12px',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            🗑️ Delete message
          </button>
        )}
      </div>
    );

    const timeEl = (
      <div style={{ fontSize: '10px', opacity: 0.6, textAlign: mine ? 'right' : 'left' }}>
        {msg.encrypted ? '🔒 ' : ''}{fmt(msg.timestamp)}
      </div>
    );

    // Challenge card — use decrypted text if available (E2EE)
    const challenge = parseChallengeMsg(msg._decrypted ?? msg.message);
    if (challenge) return (
      <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
        <div className={`chat-challenge-card${mine ? ' chat-challenge-card--mine' : ''}`}>
          <div className="chat-challenge-card__icon">{challenge.icon}</div>
          <div className="chat-challenge-card__body">
            <div className="chat-challenge-card__label">⚡ {mine ? 'You challenged!' : `${displayName} challenged you!`}</div>
            <div className="chat-challenge-card__type">{challenge.label} Quiz · 10 questions</div>
            <button className={`btn ${mine ? 'btn-secondary' : 'btn-primary'} btn-sm chat-challenge-card__btn`} onClick={() => setOpenChallengeId(challenge.id)}>
              {mine ? 'Play Your Turn ⚡' : 'Accept Challenge ⚡'}
            </button>
          </div>
          <div className="chat-challenge-card__time">{fmt(msg.timestamp)}</div>
        </div>
      </div>
    );

    // Text
    if (!msg.type || msg.type === 'text') {
      const text = msg._decrypted ?? (msg.encrypted ? '🔒 Encrypted message' : msg.message);
      return bubble(<div style={{ padding: '8px 12px', wordBreak: 'break-word' }}>{text}<div style={{ marginTop: '2px' }}>{timeEl}</div></div>);
    }

    // Image — once-view: tap to load blob, then show
    if (msg.type === 'image' && msg.attachment) {
      const { attachmentId } = msg.attachment;
      const blobUrl   = viewedBlobUrls[attachmentId];
      const isViewed  = viewedOnce.has(attachmentId);
      const isLoading = loadingView.has(attachmentId);

      if (blobUrl) {
        return bubble(
          <>
            <img src={blobUrl} alt="photo" style={{ display: 'block', width: '100%', cursor: 'pointer', borderRadius: radius }}
              onClick={() => window.open(blobUrl, '_blank')} />
            <div style={{ padding: '2px 10px 6px' }}>{timeEl}</div>
          </>,
          { maxWidth: '240px', overflow: 'hidden', padding: 0 }
        );
      }

      return bubble(
        <div style={{ padding: '14px 18px', textAlign: 'center', cursor: isViewed ? 'default' : 'pointer' }}
          onClick={() => !isViewed && handleTapToView(msg)}>
          <div style={{ fontSize: '28px', marginBottom: '6px' }}>📷</div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>
            {isLoading ? 'Loading…' : isViewed ? 'Photo (viewed)' : 'Photo · Tap to view'}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.65, marginTop: '2px' }}>Disappears after viewing</div>
          <div style={{ marginTop: '6px' }}>{timeEl}</div>
        </div>,
        { minWidth: '160px' }
      );
    }

    // Video — once-view: tap to load blob, then show
    if (msg.type === 'video' && msg.attachment) {
      const { attachmentId } = msg.attachment;
      const blobUrl   = viewedBlobUrls[attachmentId];
      const isViewed  = viewedOnce.has(attachmentId);
      const isLoading = loadingView.has(attachmentId);

      if (blobUrl) {
        return bubble(
          <>
            <video src={blobUrl} controls style={{ display: 'block', width: '100%', borderRadius: radius }} />
            <div style={{ padding: '2px 10px 6px' }}>{timeEl}</div>
          </>,
          { maxWidth: '280px', overflow: 'hidden', padding: 0 }
        );
      }

      return bubble(
        <div style={{ padding: '14px 18px', textAlign: 'center', cursor: isViewed ? 'default' : 'pointer' }}
          onClick={() => !isViewed && handleTapToView(msg)}>
          <div style={{ fontSize: '28px', marginBottom: '6px' }}>🎬</div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>
            {isLoading ? 'Loading…' : isViewed ? 'Video (viewed)' : 'Video · Tap to view'}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.65, marginTop: '2px' }}>Disappears after viewing</div>
          <div style={{ marginTop: '6px' }}>{timeEl}</div>
        </div>,
        { minWidth: '160px' }
      );
    }

    // Voice — normal player (24h TTL)
    if (msg.type === 'voice' && msg.attachment)
      return bubble(
        <div style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🎤</span>
            <audio src={resolveUrl(msg.attachment.url)} controls style={{ height: '30px', flex: 1 }} />
          </div>
          {msg.attachment.duration !== undefined && (
            <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '3px' }}>{fmtDur(msg.attachment.duration)}</div>
          )}
          <div style={{ marginTop: '3px' }}>{timeEl}</div>
        </div>
      );

    return null;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* File input — only image and video */}
      <input ref={fileInputRef} type="file" style={{ display: 'none' }}
        accept="image/*,video/*"
        onChange={handleFileSelected}
      />

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-small" onClick={e => e.stopPropagation()}
          style={{ display: 'flex', flexDirection: 'column', height: '560px', padding: 0 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--card)', position: 'relative' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--ig-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0, overflow: 'hidden' }}>
              {targetUser.photos?.[0] ? <img src={targetUser.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : avatarInitial}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{displayName}</div>
              <div style={{ fontSize: '11px', color: 'var(--ig-secondary)', display: 'flex', gap: '6px' }}>
                <span style={{ color: isConnected ? '#22c55e' : 'inherit' }}>{isConnected ? 'Online' : 'Offline'}</span>
                {e2eeReady && <span>🔒 E2E Encrypted</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button onClick={() => initiateCall(targetUser, 'audio')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>📞</button>
              <button onClick={() => initiateCall(targetUser, 'video')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>📹</button>
              <button onClick={() => setShowChallengePicker(v => !v)} style={{ background: showChallengePicker ? 'rgba(168,85,247,.15)' : 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px', borderRadius: '6px' }}>⚡</button>
            </div>
            <button onClick={onClose} className="modal-close">✕</button>

            {showChallengePicker && (
              <div className="chat-challenge-picker" onClick={e => e.stopPropagation()}>
                <div className="chat-challenge-picker__title">⚡ Maths Challenge</div>
                <p style={{ fontSize: '12px', color: 'var(--ig-secondary)', margin: '4px 0 10px', textAlign: 'center' }}>
                  🔢 Arithmetic · 10 questions
                </p>
                {challengeError && (
                  <p style={{ color: '#ef4444', fontSize: '12px', margin: '0 0 8px', textAlign: 'center' }}>{challengeError}</p>
                )}
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleCreateChallenge} disabled={challengeCreating}>
                  {challengeCreating ? 'Sending…' : '⚡ Send Challenge'}
                </button>
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg)' }} onClick={() => setSelectedMsgId(null)}>
            {loading
              ? <div className="loading"><div className="loading-spinner" /></div>
              : messages.length === 0
                ? <div style={{ textAlign: 'center', color: 'var(--ig-secondary)', fontSize: '13px', marginTop: '40px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
                    <p>No messages yet. Say hi!</p>
                    {e2eeReady && <p style={{ fontSize: '11px', marginTop: '6px' }}>🔒 Messages are end-to-end encrypted</p>}
                  </div>
                : messages.map(renderMsg)
            }
            {uploading && (
              <div style={{ fontSize: '12px', color: 'var(--ig-secondary)', textAlign: 'center' }}>
                Uploading… {uploadPct}%
                <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginTop: 4 }}>
                  <div style={{ height: '100%', width: `${uploadPct}%`, background: 'var(--ig-blue)', borderRadius: 2, transition: 'width .2s' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ borderTop: '1px solid var(--border)', background: 'var(--card)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>

            {/* Pending attachment preview */}
            {pendingAtt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--card-2)', borderRadius: '12px', border: `1px solid ${pendingAtt.error ? '#ef4444' : 'var(--border)'}` }}>
                {pendingAtt.preview && !pendingAtt.error
                  ? pendingAtt.type === 'image'
                    ? <img src={pendingAtt.preview} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                    : <video src={pendingAtt.preview} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} muted />
                  : <span style={{ fontSize: '28px', flexShrink: 0 }}>{pendingAtt.type === 'video' ? '🎬' : '🖼️'}</span>
                }

                <div style={{ flex: 1, minWidth: 0 }}>
                  {pendingAtt.error
                    ? <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600 }}>{pendingAtt.error}</div>
                    : <>
                        <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pendingAtt.file.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--ig-secondary)' }}>
                          {pendingAtt.durationLabel ? `🎬 ${pendingAtt.durationLabel}` : '📷 Once-view · disappears after viewing'}
                        </div>
                      </>
                  }
                </div>

                <button onClick={() => { if (pendingAtt.preview) URL.revokeObjectURL(pendingAtt.preview); setPendingAtt(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px', flexShrink: 0 }}>✕</button>

                {!pendingAtt.error && (
                  <button onClick={sendAttachment} disabled={uploading}
                    style={{ background: 'var(--ig-blue)', color: 'white', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                    ➤
                  </button>
                )}
              </div>
            )}

            {/* Voice preview */}
            {voiceBlob && !recording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'var(--card-2)', borderRadius: '10px' }}>
                <span>🎤</span>
                <audio src={URL.createObjectURL(voiceBlob)} controls style={{ height: '28px', flex: 1 }} />
                <span style={{ fontSize: '12px', color: 'var(--ig-secondary)', flexShrink: 0 }}>{fmtDur(recordSecs)}</span>
                <button onClick={cancelVoice} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>✕</button>
                <button onClick={sendVoice} disabled={uploading} style={{ background: 'var(--ig-blue)', color: 'white', border: 'none', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Send</button>
              </div>
            )}

            {/* Recording */}
            {recording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', background: 'rgba(239,68,68,.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,.25)' }}>
                <span style={{ color: '#ef4444' }}>⏺</span>
                <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '13px' }}>{fmtDur(recordSecs)}</span>
                <span style={{ flex: 1, fontSize: '12px', color: 'var(--ig-secondary)' }}>Recording…</span>
                <button onClick={stopRecording} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Stop</button>
              </div>
            )}

            {/* Main input row */}
            {!pendingAtt && !voiceBlob && !recording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={() => fileInputRef.current?.click()} title="Attach image or video"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--ig-secondary)', flexShrink: 0 }}>
                  📎
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                  placeholder={e2eeReady ? '🔒 Message (encrypted)…' : 'Message…'}
                  style={{ flex: 1, padding: '8px 14px', borderRadius: '20px', border: '1px solid var(--border)', fontSize: '14px', background: 'var(--card-2)', outline: 'none', color: 'var(--text)' }}
                  autoFocus
                />
                {input.trim()
                  ? <button onClick={() => sendText()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ig-blue)', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>Send</button>
                  : <button onClick={startRecording} title="Record voice note" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', flexShrink: 0 }}>🎤</button>
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {openChallengeId && (
        <FriendChallengeModal challengeId={openChallengeId} opponentName={displayName} onClose={() => setOpenChallengeId(null)} />
      )}
    </>
  );
};
