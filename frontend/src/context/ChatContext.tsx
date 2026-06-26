import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ConversationEntry, ChatMessage } from '@/types/api';
import { chatService } from '@/services/chatService';
import { useSocket } from '@/context/SocketContext';

interface ChatContextType {
  conversations: ConversationEntry[];
  totalUnread: number;
  activeChatPartner: string | null;
  setActiveChatPartner: (id: string | null) => void;
  markRead: (partnerId: string) => void;
  fetchConversations: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [activeChatPartner, setActiveChatPartner] = useState<string | null>(null);
  const { on, off } = useSocket();
  const activePartnerRef = useRef<string | null>(null);

  // Keep ref in sync with state so socket handlers (closures) always see current value
  useEffect(() => {
    activePartnerRef.current = activeChatPartner;
  }, [activeChatPartner]);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await chatService.getConversations(30);
      setConversations(data.map(c => ({ ...c, unreadCount: c.unreadCount ?? 0 })));
    } catch {
      // non-fatal
    }
  }, []);

  const markRead = useCallback((partnerId: string) => {
    setConversations(prev =>
      prev.map(c => c.partnerId === partnerId ? { ...c, unreadCount: 0 } : c)
    );
  }, []);

  const upsertConversation = useCallback((partnerId: string, lastMessage: string, lastMessageTime: string, addUnread: boolean) => {
    setConversations(prev => {
      const idx = prev.findIndex(c => c.partnerId === partnerId);
      const existing = prev[idx];
      const updated: ConversationEntry = {
        partnerId,
        lastMessage,
        lastMessageTime,
        unreadCount: (existing?.unreadCount ?? 0) + (addUnread ? 1 : 0),
      };
      if (idx >= 0) {
        const rest = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        return [updated, ...rest];
      }
      return [updated, ...prev];
    });
  }, []);

  useEffect(() => {
    const handleIncoming = (msg: ChatMessage) => {
      const isActive = activePartnerRef.current === msg.fromUserId;
      upsertConversation(msg.fromUserId, msg.message, msg.timestamp, !isActive);
    };

    const handleSent = (msg: ChatMessage) => {
      upsertConversation(msg.toUserId, msg.message, msg.timestamp, false);
    };

    on('chat:message', handleIncoming);
    on('chat:message:sent', handleSent);

    return () => {
      off('chat:message', handleIncoming);
      off('chat:message:sent', handleSent);
    };
  }, [on, off, upsertConversation]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  return (
    <ChatContext.Provider value={{
      conversations,
      totalUnread,
      activeChatPartner,
      setActiveChatPartner,
      markRead,
      fetchConversations,
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = (): ChatContextType => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
};
