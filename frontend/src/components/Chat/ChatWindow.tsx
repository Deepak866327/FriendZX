import React, { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth';

export interface ChatMessage {
  id:          string;
  senderId:    string;
  recipientId: string;
  content:     string;
  timestamp:   Date;
  read:        boolean;
}

interface ChatWindowProps {
  recipientId:   string;
  recipientName: string;
  onClose?:      () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ recipientId, recipientName, onClose }) => {
  const { user }   = useAuth();
  const { emit, on, off } = useWebSocket();
  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [messageInput,  setMessageInput]  = useState('');
  const [isLoading,     setIsLoading]     = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const handleNewMessage = (data: any) => {
      if (data.senderId === recipientId || data.senderId === user?.id) {
        setMessages(prev => [...prev, {
          id:          data.id || Math.random().toString(36).slice(2),
          senderId:    data.senderId,
          recipientId: data.recipientId,
          content:     data.content,
          timestamp:   new Date(data.timestamp),
          read:        data.read || false,
        }]);
      }
    };
    on('message:received', handleNewMessage);
    return () => off('message:received', handleNewMessage);
  }, [recipientId, user?.id, on, off]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isLoading) return;
    try {
      setIsLoading(true);
      emit('message:send', { recipientId, content: messageInput.trim() });
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).slice(2),
        senderId: user?.id || '',
        recipientId,
        content: messageInput.trim(),
        timestamp: new Date(),
        read: false,
      }]);
      setMessageInput('');
    } finally { setIsLoading(false); }
  };

  const SPRING = { type: 'spring', damping: 20, stiffness: 400 } as const;

  return (
    <div className="glass-strong rounded-3xl flex flex-col overflow-hidden" style={{ height: 480, width: 360 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/40 flex-shrink-0">
        <h3 className="text-sm font-bold text-slate-800 truncate">{recipientName}</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="btn-icon w-7 h-7 rounded-xl text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ scrollbarWidth: 'none' }}>
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map(msg => {
            const mine = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-3 py-2 text-sm rounded-[18px] ${mine ? 'rounded-br-[4px] text-white' : 'rounded-bl-[4px] glass text-slate-800'}`}
                  style={mine ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' } : undefined}
                >
                  <p>{msg.content}</p>
                  <p className="text-[10px] opacity-60 mt-1">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="flex items-center gap-2 px-3 py-2.5 border-t border-white/40 bg-white/40 flex-shrink-0">
        <input
          type="text"
          value={messageInput}
          onChange={e => setMessageInput(e.target.value)}
          placeholder="Type a message…"
          disabled={isLoading}
          className="input-glass flex-1 rounded-2xl text-sm"
          style={{ paddingTop: 7, paddingBottom: 7 }}
        />
        <motion.button
          type="submit"
          disabled={isLoading || !messageInput.trim()}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
          whileTap={{ scale: 0.85 }}
          transition={SPRING}
        >
          <Send size={14} />
        </motion.button>
      </form>
    </div>
  );
};
