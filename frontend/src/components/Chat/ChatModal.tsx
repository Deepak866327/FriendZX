import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Phone, Video, Zap, Paperclip, Mic, Send, Loader, Trash2, Lock, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage, PublicProfile } from '@/types/api';
import { chatService } from '@/services/chatService';
import { useSocket } from '@/context/SocketContext';
import { useChatContext } from '@/context/ChatContext';
import { useCallContext } from '@/context/CallContext';
import { storage } from '@/utils/storage';
import { overlayVariants, sheetVariants } from '@/utils/animations';
import {
  getOrCreateKeyPair, getPublicKeyJwk, importPublicKey,
  deriveSharedKey, encryptMessage, decryptMessage,
} from '@/utils/chatCrypto';
import challengeService from '@/services/challengeService';
import { FriendChallengeModal } from '@/components/Challenge/FriendChallengeModal';

// ── Challenge helpers ──────────────────────────────────────────────────────
const CHALLENGE_TYPES = [{ key: 'math', icon: '🔢', label: 'Maths' }];
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
function fmt(ts: string) {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

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

const GRADIENTS = [
  'from-indigo-500 to-violet-600', 'from-violet-500 to-purple-600',
  'from-sky-400 to-blue-500',      'from-pink-500 to-rose-500',
  'from-amber-400 to-orange-500',  'from-emerald-400 to-teal-500',
];
function avatarGradient(uid: string) {
  const n = uid.charCodeAt(0) + uid.charCodeAt(uid.length - 1);
  return GRADIENTS[n % GRADIENTS.length];
}

const SPRING = { type: 'spring', damping: 20, stiffness: 400 } as const;

interface PendingAttachment {
  file:           File;
  preview?:       string;
  type:           'image' | 'video';
  durationLabel?: string;
  error?:         string;
}

interface Props { targetUser: PublicProfile; onClose: () => void; }

export const ChatModal: React.FC<Props> = ({ targetUser, onClose }) => {
  const [open,            setOpen]            = useState(true);
  const [messages,        setMessages]        = useState<ChatMessage[]>([]);
  const [input,           setInput]           = useState('');
  const [loading,         setLoading]         = useState(true);
  const [e2eeReady,       setE2eeReady]       = useState(false);
  const e2eeKeyRef = useRef<CryptoKey | null>(null);
  const [selectedMsgId,   setSelectedMsgId]   = useState<string | null>(null);

  // Attachment
  const [pendingAtt,  setPendingAtt]  = useState<PendingAttachment | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadPct,   setUploadPct]   = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice
  const [recording,   setRecording]   = useState(false);
  const [recordSecs,  setRecordSecs]  = useState(0);
  const [voiceBlob,   setVoiceBlob]   = useState<Blob | null>(null);
  const mediaRecRef    = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval>>();
  const chunksRef      = useRef<BlobPart[]>([]);

  // Once-view
  const [viewedOnce,    setViewedOnce]    = useState<Set<string>>(new Set());
  const [viewedBlobUrls, setViewedBlobUrls] = useState<Record<string, string>>({});
  const [loadingView,   setLoadingView]   = useState<Set<string>>(new Set());

  // Challenge
  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [selectedType,         setSelectedType]        = useState('math');
  const [challengeCreating,    setChallengeCreating]   = useState(false);
  const [challengeError,       setChallengeError]      = useState('');
  const [openChallengeId,      setOpenChallengeId]     = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const { on, off, emit, isConnected } = useSocket();
  const { markRead, setActiveChatPartner } = useChatContext();
  const { initiateCall } = useCallContext();
  const me = storage.getUser()?.id || '';

  const displayName  = targetUser.firstName
    ? `${targetUser.firstName} ${targetUser.lastName || ''}`.trim()
    : targetUser.userId.slice(0, 8);
  const avatarInitial = (targetUser.firstName || targetUser.userId).charAt(0).toUpperCase();

  const handleClose = () => setOpen(false);

  // ── tryDecrypt ─────────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!e2eeReady || messages.length === 0) return;
    (async () => { setMessages(await Promise.all(messages.map(tryDecrypt))); })();
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
      setMessages(p => [...p, ...[] as ChatMessage[]]);
      const dec = await tryDecrypt({ ...m, type: m.type || 'text' as const });
      setMessages(p => [...p, dec]);
    };
    const onOut = async (m: ChatMessage) => {
      if (m.toUserId !== targetUser.userId) return;
      const dec = await tryDecrypt({ ...m, type: m.type || 'text' as const });
      setMessages(p => [...p, dec]);
    };
    const onDeleted = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, deleted: true, message: '', _decrypted: undefined } : m
      ));
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

  // ── Delete message ─────────────────────────────────────────────────────────
  const handleDeleteMessage = useCallback((msgId: string) => {
    emit('chat:delete', { messageId: msgId, toUserId: targetUser.userId });
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, deleted: true, message: '', _decrypted: undefined } : m
    ));
    setSelectedMsgId(null);
  }, [emit, targetUser.userId]);

  // ── File attachment ────────────────────────────────────────────────────────
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type.startsWith('image/')) {
      setPendingAtt({ file, preview: URL.createObjectURL(file), type: 'image' });
      return;
    }
    if (file.type.startsWith('video/')) {
      try {
        const duration = await getVideoDuration(file);
        if (duration > 30) {
          setPendingAtt({ file, type: 'video', error: `Video is ${Math.round(duration)}s — maximum is 30 seconds` });
          return;
        }
        setPendingAtt({ file, preview: URL.createObjectURL(file), type: 'video', durationLabel: fmtDur(duration) });
      } catch { setPendingAtt({ file, type: 'video', error: 'Could not read video' }); }
      return;
    }
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
  const cancelVoice   = () => { setVoiceBlob(null); setRecordSecs(0); };
  const sendVoice = async () => {
    if (!voiceBlob) return;
    setUploading(true);
    try {
      const ext = voiceBlob.type.includes('webm') ? '.webm' : '.mp4';
      const att = await chatService.uploadAttachment(voiceBlob, 'voice', `voice${ext}`, setUploadPct);
      emit('chat:send', { toUserId: targetUser.userId, message: '', type: 'voice', attachment: { ...att, duration: recordSecs } });
      setVoiceBlob(null); setRecordSecs(0);
    } catch {}
    finally { setUploading(false); setUploadPct(0); }
  };

  // ── Challenge ──────────────────────────────────────────────────────────────
  const handleCreateChallenge = async () => {
    setChallengeCreating(true); setChallengeError('');
    try {
      const { id } = await challengeService.createFriendChallenge(targetUser.userId, selectedType);
      const t = CHALLENGE_TYPES.find(x => x.key === selectedType)!;
      emit('chat:send', { toUserId: targetUser.userId, message: encodeChallengeMsg(id, selectedType, t.label, t.icon), type: 'text' });
      setShowChallengePicker(false);
    } catch (err: any) {
      setChallengeError(err?.response?.data?.error || err?.message || 'Failed to create challenge');
    } finally { setChallengeCreating(false); }
  };

  // ── Once-view ──────────────────────────────────────────────────────────────
  const handleTapToView = async (msg: ChatMessage) => {
    if (!msg.attachment) return;
    const { attachmentId, url } = msg.attachment;
    if (viewedOnce.has(attachmentId) || loadingView.has(attachmentId)) return;
    setLoadingView(prev => new Set(prev).add(attachmentId));
    try {
      const response = await fetch(resolveUrl(url));
      if (!response.ok) throw new Error('Gone');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setViewedBlobUrls(prev => ({ ...prev, [attachmentId]: blobUrl }));
      setViewedOnce(prev => new Set(prev).add(attachmentId));
    } catch { setViewedOnce(prev => new Set(prev).add(attachmentId)); }
    finally { setLoadingView(prev => { const s = new Set(prev); s.delete(attachmentId); return s; }); }
  };

  const isMe = (m: ChatMessage) => m.fromUserId === me;

  // ── Message renderer ───────────────────────────────────────────────────────
  const renderMsg = (msg: ChatMessage) => {
    const mine   = isMe(msg);
    const radius = mine ? 'rounded-[18px_18px_4px_18px]' : 'rounded-[18px_18px_18px_4px]';
    const isSelected = selectedMsgId === msg.id;

    // Deleted
    if (msg.deleted) {
      return (
        <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className="px-3 py-2 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs italic max-w-[72%]">
            This message was deleted
          </div>
        </div>
      );
    }

    const timeEl = (
      <div className={`text-[10px] mt-1 opacity-60 ${mine ? 'text-right' : 'text-left'}`}>
        {msg.encrypted && <Lock size={8} className="inline mr-0.5 mb-px" />}
        {fmt(msg.timestamp)}
      </div>
    );

    const bubble = (children: React.ReactNode, extra?: string) => (
      <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        <motion.div
          className={`max-w-[72%] text-sm cursor-pointer ${radius} ${extra ?? ''} ${
            mine
              ? 'text-white'
              : 'glass text-slate-800'
          }`}
          style={mine ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' } : undefined}
          onClick={mine ? () => setSelectedMsgId(prev => prev === msg.id ? null : msg.id) : undefined}
          whileTap={mine ? { scale: 0.97 } : undefined}
          transition={SPRING}
        >
          {children}
        </motion.div>
        <AnimatePresence>
          {isSelected && mine && (
            <motion.button
              initial={{ opacity: 0, y: -4, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.9 }}
              transition={SPRING}
              onClick={() => handleDeleteMessage(msg.id)}
              className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-500 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100"
            >
              <Trash2 size={10} /> Delete message
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    );

    // Challenge card
    const challenge = parseChallengeMsg(msg._decrypted ?? msg.message);
    if (challenge) return (
      <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[72%] rounded-2xl overflow-hidden glass">
          <div className="px-4 py-3">
            <div className="flex items-start gap-2.5 mb-2">
              <span className="text-2xl">{challenge.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-600">
                  ⚡ {mine ? 'You challenged!' : `${displayName} challenged you!`}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{challenge.label} Quiz · 10 questions</p>
              </div>
            </div>
            <button
              className={`w-full text-xs font-bold py-2 px-3 rounded-xl ${mine ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => setOpenChallengeId(challenge.id)}
            >
              {mine ? 'Play Your Turn ⚡' : 'Accept Challenge ⚡'}
            </button>
          </div>
          <div className="px-4 pb-2 text-[10px] text-slate-400">{fmt(msg.timestamp)}</div>
        </div>
      </div>
    );

    // Text
    if (!msg.type || msg.type === 'text') {
      const text = msg._decrypted ?? (msg.encrypted ? '🔒 Encrypted message' : msg.message);
      return bubble(
        <div className="px-3 py-2 leading-relaxed" style={{ wordBreak: 'break-word' }}>
          {text}
          {timeEl}
        </div>
      );
    }

    // Image (once-view)
    if (msg.type === 'image' && msg.attachment) {
      const { attachmentId } = msg.attachment;
      const blobUrl   = viewedBlobUrls[attachmentId];
      const isViewed  = viewedOnce.has(attachmentId);
      const isLoading = loadingView.has(attachmentId);
      if (blobUrl) {
        return bubble(
          <>
            <img src={blobUrl} alt="photo" className="block w-full cursor-pointer" style={{ borderRadius: 'inherit' }}
              onClick={() => window.open(blobUrl, '_blank')} />
            <div className="px-3 pb-2">{timeEl}</div>
          </>,
          'max-w-[240px] overflow-hidden !p-0'
        );
      }
      return bubble(
        <div className="px-4 py-4 text-center cursor-pointer" onClick={() => !isViewed && handleTapToView(msg)}>
          <div className="text-2xl mb-2">📷</div>
          <p className="text-xs font-semibold">
            {isLoading ? 'Loading…' : isViewed ? 'Photo (viewed)' : 'Photo · Tap to view'}
          </p>
          <p className="text-[11px] opacity-60 mt-0.5">Disappears after viewing</p>
          {timeEl}
        </div>,
        'min-w-[160px]'
      );
    }

    // Video (once-view)
    if (msg.type === 'video' && msg.attachment) {
      const { attachmentId } = msg.attachment;
      const blobUrl   = viewedBlobUrls[attachmentId];
      const isViewed  = viewedOnce.has(attachmentId);
      const isLoading = loadingView.has(attachmentId);
      if (blobUrl) {
        return bubble(
          <>
            <video src={blobUrl} controls className="block w-full" style={{ borderRadius: 'inherit' }} />
            <div className="px-3 pb-2">{timeEl}</div>
          </>,
          'max-w-[280px] overflow-hidden !p-0'
        );
      }
      return bubble(
        <div className="px-4 py-4 text-center cursor-pointer" onClick={() => !isViewed && handleTapToView(msg)}>
          <div className="text-2xl mb-2">🎬</div>
          <p className="text-xs font-semibold">
            {isLoading ? 'Loading…' : isViewed ? 'Video (viewed)' : 'Video · Tap to view'}
          </p>
          <p className="text-[11px] opacity-60 mt-0.5">Disappears after viewing</p>
          {timeEl}
        </div>,
        'min-w-[160px]'
      );
    }

    // Voice
    if (msg.type === 'voice' && msg.attachment) {
      return bubble(
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Mic size={14} className={mine ? 'text-white/80' : 'text-indigo-400'} />
            <audio src={resolveUrl(msg.attachment.url)} controls className="h-7 flex-1" style={{ maxWidth: 160 }} />
          </div>
          {msg.attachment.duration !== undefined && (
            <p className="text-[10px] opacity-60 mt-1">{fmtDur(msg.attachment.duration)}</p>
          )}
          {timeEl}
        </div>
      );
    }

    return null;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelected} />

      <AnimatePresence onExitComplete={onClose}>
        {open && (
          <motion.div
            className="fixed inset-0 z-50"
            style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={handleClose}
          >
            <div className="absolute inset-0 bg-[#0f0a28]/40" />

            {/* Sheet — slides up on mobile, centered on desktop */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 md:inset-0 md:flex md:items-center md:justify-center md:p-4"
              onClick={e => e.stopPropagation()}
            >
              <motion.div
                className="glass-strong w-full md:max-w-sm md:rounded-3xl rounded-t-3xl flex flex-col overflow-hidden"
                style={{ height: '90dvh', maxHeight: '90dvh' }}
                variants={sheetVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* Drag handle (mobile) */}
                <div className="w-10 h-1 rounded-full bg-slate-300/70 mx-auto mt-3 mb-0.5 flex-shrink-0 md:hidden" />

                {/* ── Header ── */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/40 flex-shrink-0 relative">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(targetUser.userId)} flex items-center justify-center text-white text-sm font-bold ring-2 ring-white overflow-hidden`}>
                      {targetUser.photos?.[0]
                        ? <img src={targetUser.photos[0]} alt="" className="w-full h-full object-cover" />
                        : avatarInitial
                      }
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-[1.5px] ring-white ${isConnected ? 'bg-emerald-400' : 'bg-slate-300'}`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{displayName}</p>
                    <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                      <span className={isConnected ? 'text-emerald-500' : 'text-slate-400'}>
                        {isConnected ? 'Online' : 'Offline'}
                      </span>
                      {e2eeReady && (
                        <span className="text-indigo-400 flex items-center gap-0.5">
                          <Lock size={9} />E2EE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-0.5">
                    <motion.button
                      onClick={() => initiateCall(targetUser, 'audio')}
                      className="btn-icon w-8 h-8 rounded-xl text-slate-500 hover:text-indigo-500 transition-colors"
                      whileTap={{ scale: 0.85 }} transition={SPRING}
                    >
                      <Phone size={15} />
                    </motion.button>
                    <motion.button
                      onClick={() => initiateCall(targetUser, 'video')}
                      className="btn-icon w-8 h-8 rounded-xl text-slate-500 hover:text-indigo-500 transition-colors"
                      whileTap={{ scale: 0.85 }} transition={SPRING}
                    >
                      <Video size={15} />
                    </motion.button>
                    <motion.button
                      onClick={() => setShowChallengePicker(v => !v)}
                      className={`btn-icon w-8 h-8 rounded-xl transition-colors ${showChallengePicker ? 'text-amber-500 bg-amber-50/80' : 'text-slate-500 hover:text-amber-500'}`}
                      whileTap={{ scale: 0.85 }} transition={SPRING}
                    >
                      <Zap size={15} />
                    </motion.button>
                  </div>

                  <button
                    onClick={handleClose}
                    className="btn-icon w-8 h-8 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100/60 transition-colors ml-0.5"
                    aria-label="Close"
                  >
                    <X size={15} />
                  </button>

                  {/* Challenge picker dropdown */}
                  <AnimatePresence>
                    {showChallengePicker && (
                      <motion.div
                        className="absolute top-full right-0 mt-2 z-10 glass-strong rounded-2xl p-4 w-56 shadow-xl"
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={SPRING}
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="text-xs font-bold text-slate-700 mb-0.5 flex items-center gap-1">
                          <Zap size={11} className="text-amber-500" /> Math Challenge
                        </p>
                        <p className="text-[11px] text-slate-400 mb-3">🔢 Arithmetic · 10 questions</p>
                        {challengeError && (
                          <p className="text-[11px] text-rose-500 mb-2">{challengeError}</p>
                        )}
                        <button
                          className="btn-primary w-full text-xs"
                          onClick={handleCreateChallenge}
                          disabled={challengeCreating}
                        >
                          {challengeCreating ? <Loader size={12} className="animate-spin mx-auto" /> : '⚡ Send Challenge'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Messages ── */}
                <div
                  className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2"
                  style={{ scrollbarWidth: 'none' }}
                  onClick={() => setSelectedMsgId(null)}
                >
                  {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <Loader size={20} className="text-indigo-400 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-10">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
                        style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.12))' }}
                      >
                        <span className="text-xl">💬</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">Say hi!</p>
                      {e2eeReady && (
                        <p className="text-[11px] text-indigo-400 flex items-center gap-1">
                          <Lock size={9} /> Messages are end-to-end encrypted
                        </p>
                      )}
                    </div>
                  ) : (
                    messages.map(renderMsg)
                  )}

                  {/* Upload progress */}
                  <AnimatePresence>
                    {uploading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-1"
                      >
                        <p className="text-[11px] text-slate-400 text-center">Uploading… {uploadPct}%</p>
                        <div className="h-[3px] rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-200"
                            style={{ width: `${uploadPct}%`, background: 'linear-gradient(90deg,#6366f1,#ec4899)' }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div ref={bottomRef} />
                </div>

                {/* ── Input zone ── */}
                <div className="flex-shrink-0 border-t border-white/40 bg-white/40 px-3 py-2.5 flex flex-col gap-2">

                  {/* Pending attachment */}
                  <AnimatePresence>
                    {pendingAtt && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="glass rounded-xl overflow-hidden"
                      >
                        <div className={`flex items-center gap-3 p-2.5 ${pendingAtt.error ? 'border border-rose-200' : ''}`}>
                          {pendingAtt.preview && !pendingAtt.error
                            ? pendingAtt.type === 'image'
                              ? <img src={pendingAtt.preview} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                              : <video src={pendingAtt.preview} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" muted />
                            : <span className="text-2xl flex-shrink-0">{pendingAtt.type === 'video' ? '🎬' : '🖼️'}</span>
                          }
                          <div className="flex-1 min-w-0">
                            {pendingAtt.error
                              ? <p className="text-xs text-rose-500 font-semibold">{pendingAtt.error}</p>
                              : <>
                                  <p className="text-xs font-semibold text-slate-700 truncate">{pendingAtt.file.name}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {pendingAtt.durationLabel ? `🎬 ${pendingAtt.durationLabel}` : '📷 Once-view'}
                                  </p>
                                </>
                            }
                          </div>
                          <button
                            onClick={() => { if (pendingAtt.preview) URL.revokeObjectURL(pendingAtt.preview); setPendingAtt(null); }}
                            className="text-rose-400 hover:text-rose-600 flex-shrink-0"
                          >
                            <X size={14} />
                          </button>
                          {!pendingAtt.error && (
                            <motion.button
                              onClick={sendAttachment}
                              disabled={uploading}
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                              whileTap={{ scale: 0.9 }} transition={SPRING}
                            >
                              <Send size={13} />
                            </motion.button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Voice preview */}
                  <AnimatePresence>
                    {voiceBlob && !recording && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 glass rounded-xl px-3 py-2"
                      >
                        <Mic size={13} className="text-indigo-400 flex-shrink-0" />
                        <audio src={URL.createObjectURL(voiceBlob)} controls className="h-7 flex-1" />
                        <span className="text-[11px] text-slate-400">{fmtDur(recordSecs)}</span>
                        <button onClick={cancelVoice} className="text-rose-400"><X size={13} /></button>
                        <motion.button
                          onClick={sendVoice}
                          disabled={uploading}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                          whileTap={{ scale: 0.9 }} transition={SPRING}
                        >
                          <Send size={12} />
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Recording indicator */}
                  <AnimatePresence>
                    {recording && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl bg-rose-50/80 border border-rose-100"
                      >
                        <motion.div
                          className="w-2 h-2 rounded-full bg-rose-500"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                        <span className="text-xs font-bold text-rose-600">{fmtDur(recordSecs)}</span>
                        <span className="text-xs text-rose-400 flex-1">Recording…</span>
                        <button
                          onClick={stopRecording}
                          className="text-xs font-bold text-white px-2 py-1 rounded-lg"
                          style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}
                        >
                          Stop
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Main input row */}
                  {!pendingAtt && !voiceBlob && !recording && (
                    <div className="flex items-center gap-2">
                      <motion.button
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-icon w-8 h-8 rounded-xl text-slate-400 hover:text-indigo-500 transition-colors flex-shrink-0"
                        whileTap={{ scale: 0.85 }} transition={SPRING}
                        aria-label="Attach"
                      >
                        <Paperclip size={16} />
                      </motion.button>
                      <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                        placeholder={e2eeReady ? '🔒 Encrypted message…' : 'Message…'}
                        className="input-glass flex-1 rounded-2xl text-sm"
                        style={{ paddingTop: 8, paddingBottom: 8 }}
                        autoFocus
                      />
                      <AnimatePresence mode="wait">
                        {input.trim() ? (
                          <motion.button
                            key="send"
                            onClick={() => sendText()}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.7, opacity: 0 }}
                            whileTap={{ scale: 0.85 }}
                            transition={SPRING}
                          >
                            <Send size={14} />
                          </motion.button>
                        ) : (
                          <motion.button
                            key="mic"
                            onClick={startRecording}
                            className="btn-icon w-8 h-8 rounded-xl text-slate-400 hover:text-indigo-500 transition-colors flex-shrink-0"
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.7, opacity: 0 }}
                            whileTap={{ scale: 0.85 }}
                            transition={SPRING}
                            aria-label="Voice"
                          >
                            <Mic size={16} />
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {openChallengeId && (
        <FriendChallengeModal
          challengeId={openChallengeId}
          opponentName={displayName}
          onClose={() => setOpenChallengeId(null)}
        />
      )}
    </>
  );
};
