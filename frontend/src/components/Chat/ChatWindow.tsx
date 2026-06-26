import React, { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth';

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

interface ChatWindowProps {
  recipientId: string;
  recipientName: string;
  onClose?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  recipientId,
  recipientName,
  onClose,
}) => {
  const { user } = useAuth();
  const { emit, on, off } = useWebSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleNewMessage = (data: any) => {
      if (data.senderId === recipientId || data.senderId === user?.id) {
        const newMessage: ChatMessage = {
          id: data.id || Math.random().toString(36).substr(2, 9),
          senderId: data.senderId,
          recipientId: data.recipientId,
          content: data.content,
          timestamp: new Date(data.timestamp),
          read: data.read || false,
        };
        setMessages(prev => [...prev, newMessage]);
      }
    };

    on('message:received', handleNewMessage);

    return () => {
      off('message:received', handleNewMessage);
    };
  }, [recipientId, user?.id, on, off]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageInput.trim() || isLoading) {
      return;
    }

    try {
      setIsLoading(true);

      const message: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: user?.id || '',
        recipientId,
        content: messageInput.trim(),
        timestamp: new Date(),
        read: false,
      };

      // Emit via WebSocket
      emit('message:send', {
        recipientId,
        content: messageInput.trim(),
      });

      setMessages(prev => [...prev, message]);
      setMessageInput('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h3>{recipientName}</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose}>✕</button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`chat-message ${
                msg.senderId === user?.id ? 'sent' : 'received'
              }`}
            >
              <div className="message-content">
                <p>{msg.content}</p>
                <small className="message-time">
                  {msg.timestamp.toLocaleTimeString()}
                </small>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-form">
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
          className="chat-input"
        />
        <button
          type="submit"
          disabled={isLoading || !messageInput.trim()}
          className="btn btn-primary btn-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
};