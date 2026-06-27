import { apiClient, getApiToken } from './api';
import { ChatMessage, ConversationEntry, ChatMsgType, ChatAttachment } from '@/types/api';

export const chatService = {
  getChatHistory: async (toUserId: string, limit = 50): Promise<ChatMessage[]> => {
    const res = await apiClient.get<{ messages: ChatMessage[] }>(
      `/notifications/chat/${toUserId}`,
      { params: { limit } }
    );
    return (res.data.messages || []).map(m => ({ ...m, type: m.type || 'text' as const }));
  },

  getConversations: async (limit = 30): Promise<ConversationEntry[]> => {
    const res = await apiClient.get<{ conversations: ConversationEntry[] }>(
      '/notifications/conversations',
      { params: { limit } }
    );
    return res.data.conversations || [];
  },

  // ── E2EE public key management ─────────────────────────────────────────

  storePublicKey: async (publicKey: JsonWebKey): Promise<void> => {
    await apiClient.post('/notifications/chat/public-key', { publicKey });
  },

  getPublicKey: async (userId: string): Promise<JsonWebKey | null> => {
    try {
      const res = await apiClient.get<{ publicKey: JsonWebKey }>(`/notifications/chat/public-key/${userId}`);
      return res.data.publicKey;
    } catch {
      return null; // partner hasn't enabled E2EE yet
    }
  },

  // ── Attachment upload ──────────────────────────────────────────────────

  uploadAttachment: async (
    file: File | Blob,
    type: ChatMsgType,
    fileName?: string,
    onProgress?: (pct: number) => void,
  ): Promise<ChatAttachment> => {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('file', file, fileName || (file as File).name || 'attachment');
      form.append('type', type);

      const { XMLHttpRequest: XHR } = window;
      const xhr = new XHR();

      const token = getApiToken() || '';
      xhr.open('POST', '/api/notifications/chat/upload');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error('Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(form);
    });
  },

  // ── Delete conversation ────────────────────────────────────────────────

  deleteConversation: async (partnerId: string): Promise<void> => {
    await apiClient.delete(`/notifications/conversations/${partnerId}`);
  },

  // ── Once-view cleanup ──────────────────────────────────────────────────

  markOnceViewed: async (attachmentId: string): Promise<void> => {
    await apiClient.delete(`/notifications/chat/attachment/${attachmentId}/once-view`).catch(() => {});
  },
};
