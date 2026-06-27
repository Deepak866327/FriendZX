import React, { useEffect, useState } from 'react';
import { X, Share2, MessageCircle, Sparkles, Check, Link, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatService } from '@/services/chatService';
import { userService } from '@/services/userService';
import { useSocket } from '@/context/SocketContext';
import { PublicProfile } from '@/types/api';
import { StoryCreator } from '@/components/Story/StoryCreator';
import {
  overlayVariants, sheetVariants,
  staggerListVariants, staggerItemVariants,
} from '@/utils/animations';

interface Props {
  type: 'post' | 'cration';
  id: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  userLocation?: { latitude: number; longitude: number } | null;
  onShare?: () => void;
  onClose: () => void;
}

export const ShareSheet: React.FC<Props> = ({
  type, id, text, mediaUrl, mediaType = 'image', userLocation, onShare, onClose,
}) => {
  const { emit } = useSocket();
  const [view, setView] = useState<'main' | 'friends' | 'story'>('main');
  const [conversations, setConversations] = useState<{ partnerId: string; lastMessage: string }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const handleExternalShare = async () => {
    onShare?.();
    const shareData = {
      title: type === 'post' ? 'Check out this post' : 'Check out this cration',
      text: text || (type === 'post' ? 'Shared a post' : 'Shared a cration'),
      url: window.location.href,
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
      onClose();
    } else {
      await navigator.clipboard.writeText(shareData.url).catch(() => {});
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 1500);
    }
  };

  const loadConversations = async () => {
    setLoadingConvos(true);
    try {
      const convos = await chatService.getConversations(30);
      setConversations(convos);
      const ids = [...new Set(convos.map(c => c.partnerId))];
      await Promise.allSettled(ids.map(async pid => {
        try {
          const p = await userService.getPublicProfile(pid);
          setProfiles(prev => ({ ...prev, [pid]: p }));
        } catch {}
      }));
    } catch {}
    setLoadingConvos(false);
  };

  useEffect(() => {
    if (view === 'friends') loadConversations();
  }, [view]);

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

  if (view === 'story') {
    return (
      <StoryCreator
        userLocation={userLocation}
        initialMediaUrl={mediaUrl}
        initialMediaType={mediaType}
        onCreated={() => { onShare?.(); onClose(); }}
        onClose={() => setView('main')}
      />
    );
  }

  const shareOptions = [
    {
      icon: <Share2 size={22} />,
      label: copied ? 'Copied!' : 'Share / Copy',
      gradient: 'from-indigo-500 to-violet-500',
      action: handleExternalShare,
      active: copied,
    },
    {
      icon: <MessageCircle size={22} />,
      label: 'Send to friend',
      gradient: 'from-sky-400 to-indigo-500',
      action: () => setView('friends'),
    },
    ...(mediaUrl ? [{
      icon: <Sparkles size={22} />,
      label: 'Add to story',
      gradient: 'from-pink-500 to-rose-500',
      action: () => setView('story'),
    }] : []),
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        style={{ background: 'rgba(15,10,40,0.50)', backdropFilter: 'blur(4px)' }}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      >
        <motion.div
          className="glass-strong rounded-t-3xl w-full"
          variants={sheetVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-300/70" />
          </div>

          {/* ── MAIN VIEW ── */}
          {view === 'main' && (
            <div className="px-6 pb-8 pt-4 pb-safe">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-semibold text-slate-800">Share</h3>
                <button className="btn-icon text-slate-500" onClick={onClose} aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {shareOptions.map(opt => (
                  <button
                    key={opt.label}
                    onClick={opt.action}
                    className="flex flex-col items-center gap-2.5 group"
                  >
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${opt.gradient} flex items-center justify-center text-white shadow-lg shadow-indigo-200/50 group-hover:scale-105 group-active:scale-95 transition-transform`}>
                      {opt.active ? <Check size={22} /> : opt.icon}
                    </div>
                    <span className="text-xs font-medium text-slate-600 text-center leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── FRIEND PICKER VIEW ── */}
          {view === 'friends' && (
            <div className="flex flex-col" style={{ maxHeight: '70vh' }}>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/30 flex-shrink-0">
                <button className="btn-icon text-slate-500" onClick={() => setView('main')} aria-label="Back">
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm font-semibold text-slate-800 flex-1">Send to friend</span>
                <button className="btn-icon text-slate-500" onClick={onClose} aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              {/* Friend list */}
              <div className="flex-1 overflow-y-auto overscroll-contain py-2">
                {loadingConvos ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-10 px-4">No conversations yet</p>
                ) : (
                  <motion.div
                    variants={staggerListVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {conversations.map(c => {
                      const isSent = sent.has(c.partnerId);
                      const p      = profiles[c.partnerId];
                      const name   = getDisplayName(c.partnerId);
                      return (
                        <motion.div
                          key={c.partnerId}
                          variants={staggerItemVariants}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-white/30 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold ring-2 ring-white/60">
                            {p?.photos?.[0]
                              ? <img src={p.photos[0]} alt="" className="w-full h-full object-cover" />
                              : name.charAt(0).toUpperCase()
                            }
                          </div>
                          <span className="flex-1 text-sm font-medium text-slate-800 truncate">{name}</span>
                          <button
                            onClick={() => sendToFriend(c.partnerId)}
                            disabled={isSent}
                            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                              isSent
                                ? 'bg-white/40 text-slate-400'
                                : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm hover:shadow-md'
                            }`}
                          >
                            {isSent ? '✓ Sent' : 'Send'}
                          </button>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </div>

              {/* Done */}
              <div className="px-5 py-4 border-t border-white/30 pb-safe flex-shrink-0">
                <button className="btn-primary w-full" onClick={onClose}>Done</button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
