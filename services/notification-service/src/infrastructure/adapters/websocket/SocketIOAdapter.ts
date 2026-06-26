import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { Logger } from '../../../../../../shared/utils/logger';
import { INotificationRepository } from '../../../domain/repositories/INotificationRepository';

const logger = new Logger('SocketIOAdapter');

export class SocketIOAdapter {
  private io: SocketIOServer;
  private userSockets: Map<string, Set<string>> = new Map();
  private redis: Redis;

  constructor(
    server: HTTPServer,
    private notificationRepository: INotificationRepository,
    redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379'
  ) {
    this.redis = new Redis(redisUrl);
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.SOCKET_IO_CORS?.split(',') || '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.setupConnectionHandlers();
  }

  private setupConnectionHandlers() {
    this.io.on('connection', async (socket: Socket) => {
      const userId = socket.handshake.query.userId as string;

      if (!userId) {
        logger.warn('Connection attempt without userId');
        socket.disconnect();
        return;
      }

      logger.info(`User connected: ${userId} (socket: ${socket.id})`);

      // Track socket
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      // Persist socket in Redis
      await this.notificationRepository.trackSocket(userId, socket.id);

      // Join user-specific room
      socket.join(`user:${userId}`);

      // Send welcome message
      socket.emit('connected', {
        message: 'Connected to notification service',
        userId,
      });

      // Handle disconnect
      socket.on('disconnect', async () => {
        logger.info(`User disconnected: ${userId} (socket: ${socket.id})`);

        const sockets = this.userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.userSockets.delete(userId);
          }
        }

        await this.notificationRepository.removeSocket(socket.id);
      });

      // Handle ping
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
      });

      // ── Call signaling relay ─────────────────────────────────────────────

      // Non-friend call request — callee must approve before it rings
      socket.on('call:request', (data: { toUserId: string; callType: string; callId: string; fromName: string }) => {
        if (!data?.toUserId || !data?.callId) return;
        this.io.to(`user:${data.toUserId}`).emit('call:incoming-request', {
          fromUserId: userId, fromName: data.fromName || userId,
          callType: data.callType, callId: data.callId,
        });
      });

      socket.on('call:request:approve', (data: { toUserId: string; callId: string }) => {
        if (!data?.toUserId || !data?.callId) return;
        this.io.to(`user:${data.toUserId}`).emit('call:request:approved', { callId: data.callId });
      });

      socket.on('call:request:deny', (data: { toUserId: string; callId: string }) => {
        if (!data?.toUserId || !data?.callId) return;
        this.io.to(`user:${data.toUserId}`).emit('call:request:denied', { callId: data.callId });
      });

      // Direct ring (friend) or ring after approval (non-friend)
      socket.on('call:ring', (data: { toUserId: string; callType: string; callId: string; fromName: string }) => {
        if (!data?.toUserId || !data?.callId) return;
        this.io.to(`user:${data.toUserId}`).emit('call:ringing', {
          fromUserId: userId, fromName: data.fromName || userId,
          callType: data.callType, callId: data.callId,
        });
      });

      socket.on('call:accept', (data: { toUserId: string; callId: string }) => {
        if (!data?.toUserId || !data?.callId) return;
        this.io.to(`user:${data.toUserId}`).emit('call:accepted', { callId: data.callId });
      });

      socket.on('call:decline', (data: { toUserId: string; callId: string }) => {
        if (!data?.toUserId || !data?.callId) return;
        this.io.to(`user:${data.toUserId}`).emit('call:declined', { callId: data.callId });
      });

      socket.on('call:cancel', (data: { toUserId: string; callId: string }) => {
        if (!data?.toUserId || !data?.callId) return;
        this.io.to(`user:${data.toUserId}`).emit('call:cancelled', { callId: data.callId });
      });

      // WebRTC signaling — pure relay
      socket.on('call:offer', (data: { toUserId: string; callId: string; sdp: any }) => {
        if (!data?.toUserId || !data?.callId) return;
        this.io.to(`user:${data.toUserId}`).emit('call:offer', { fromUserId: userId, callId: data.callId, sdp: data.sdp });
      });

      socket.on('call:answer', (data: { toUserId: string; callId: string; sdp: any }) => {
        if (!data?.toUserId || !data?.callId) return;
        this.io.to(`user:${data.toUserId}`).emit('call:answer', { fromUserId: userId, callId: data.callId, sdp: data.sdp });
      });

      socket.on('call:ice', (data: { toUserId: string; callId: string; candidate: any }) => {
        if (!data?.toUserId || !data?.callId) return;
        this.io.to(`user:${data.toUserId}`).emit('call:ice', { fromUserId: userId, callId: data.callId, candidate: data.candidate });
      });

      socket.on('call:end', (data: { toUserId: string; callId: string }) => {
        if (!data?.toUserId || !data?.callId) return;
        this.io.to(`user:${data.toUserId}`).emit('call:ended', { callId: data.callId });
      });


      // Handle chat messages — route between users, store in Redis
      socket.on('chat:send', async (data: {
        toUserId: string;
        message: string;
        type?: string;
        iv?: string;
        encrypted?: boolean;
        attachment?: {
          attachmentId: string;
          url: string;
          fileName?: string;
          fileSize?: number;
          mimeType?: string;
          duration?: number;
        };
      }) => {
        if (!data?.toUserId) return;
        const msgType = data.type || 'text';
        // Text messages must have content; attachment messages don't need message text
        if (msgType === 'text' && !data.message?.trim()) return;

        const chatMsg: any = {
          id: randomUUID(),
          fromUserId: userId,
          toUserId: data.toUserId,
          message: data.message?.trim() || '',
          type: msgType,
          encrypted: data.encrypted || false,
          iv: data.iv || undefined,
          attachment: data.attachment || undefined,
          timestamp: new Date().toISOString(),
          read: false,
        };

        const convKey = `chat:${[userId, data.toUserId].sort().join(':')}`;
        try {
          await this.redis.lpush(convKey, JSON.stringify(chatMsg));
          await this.redis.ltrim(convKey, 0, 199);
          await this.redis.expire(convKey, 60 * 60 * 24 * 30);
        } catch (err) {
          logger.error(`Failed to store chat message: ${(err as Error).message}`);
        }

        // Update conversation index for both parties
        try {
          const ts = Date.now();
          await this.redis.zadd(`user:${userId}:convos`, ts, data.toUserId);
          await this.redis.zadd(`user:${data.toUserId}:convos`, ts, userId);
          await this.redis.expire(`user:${userId}:convos`, 60 * 60 * 24 * 90);
          await this.redis.expire(`user:${data.toUserId}:convos`, 60 * 60 * 24 * 90);
        } catch (err) {
          logger.error(`Failed to update conversation index: ${(err as Error).message}`);
        }

        // Deliver to recipient & confirm to sender
        this.io.to(`user:${data.toUserId}`).emit('chat:message', chatMsg);
        socket.emit('chat:message:sent', chatMsg);

        // Push notification preview to recipient
        try {
          let senderName = userId;
          const profileRaw = await this.redis.get(`profile:${userId}`);
          if (profileRaw) {
            const p = JSON.parse(profileRaw);
            if (p.firstName) senderName = p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName;
          }
          const previewMap: Record<string, string> = {
            image: '📷 Photo', video: '🎬 Video', document: '📄 Document',
            voice: '🎤 Voice note', 'once-image': '👁 Photo (view once)', 'once-doc': '👁 Document (view once)',
          };
          const preview = msgType === 'text'
            ? (chatMsg.encrypted ? '🔒 Encrypted message' : (chatMsg.message.length > 60 ? chatMsg.message.slice(0, 60) + '…' : chatMsg.message))
            : (previewMap[msgType] || '📎 Attachment');

          this.io.to(`user:${data.toUserId}`).emit('notification:received', {
            title: `💬 ${senderName}`,
            message: preview,
            type: 'chat',
            data: { fromUserId: userId, fromName: senderName },
          });
        } catch (_) {}
      });

      // ── Delete a single message ───────────────────────────────────────────
      socket.on('chat:delete', async (data: { messageId: string; toUserId: string }) => {
        if (!data?.messageId || !data?.toUserId) return;

        const convKey = `chat:${[userId, data.toUserId].sort().join(':')}`;
        try {
          const all = await this.redis.lrange(convKey, 0, -1);
          for (let i = 0; i < all.length; i++) {
            const msg = JSON.parse(all[i]);
            if (msg.id === data.messageId && msg.fromUserId === userId) {
              // Mark as deleted — preserves position in history
              const deletedMsg = { ...msg, deleted: true, message: '', attachment: undefined };
              await this.redis.lset(convKey, i, JSON.stringify(deletedMsg));
              // Notify both parties
              this.io.to(`user:${data.toUserId}`).emit('chat:message:deleted', { messageId: data.messageId });
              socket.emit('chat:message:deleted', { messageId: data.messageId });
              break;
            }
          }
        } catch (err) {
          logger.error(`Failed to delete message: ${(err as Error).message}`);
        }
      });
    });
  }

  async getConversations(userId: string, limit = 30): Promise<any[]> {
    try {
      const partners = await this.redis.zrevrange(`user:${userId}:convos`, 0, limit - 1);
      const conversations = [];
      for (const partnerId of partners) {
        const convKey = `chat:${[userId, partnerId].sort().join(':')}`;
        const msgs = await this.redis.lrange(convKey, 0, 0);
        const lastMsg = msgs[0] ? JSON.parse(msgs[0]) : null;
        conversations.push({
          partnerId,
          lastMessage: lastMsg?.message || '',
          lastMessageTime: lastMsg?.timestamp || new Date().toISOString(),
        });
      }
      return conversations;
    } catch (err) {
      logger.error(`Failed to get conversations: ${(err as Error).message}`);
      return [];
    }
  }

  async deleteConversation(userId: string, partnerId: string): Promise<void> {
    const convKey = `chat:${[userId, partnerId].sort().join(':')}`;
    // Delete all messages from the conversation
    await this.redis.del(convKey);
    // Remove from current user's conversation index
    await this.redis.zrem(`user:${userId}:convos`, partnerId);
  }

  async getChatHistory(userId1: string, userId2: string, limit = 50): Promise<any[]> {
    const convKey = `chat:${[userId1, userId2].sort().join(':')}`;
    try {
      const raw = await this.redis.lrange(convKey, 0, limit - 1);
      return raw.map(m => JSON.parse(m)).reverse();
    } catch (err) {
      logger.error(`Failed to get chat history: ${(err as Error).message}`);
      return [];
    }
  }

  async sendToUser(userId: string, event: string, data: any): Promise<void> {
    try {
      this.io.to(`user:${userId}`).emit(event, data);
      logger.debug(`Event sent to user ${userId}: ${event}`);
    } catch (error) {
      logger.error(`Error sending event to user: ${(error as Error).message}`);
    }
  }

  async sendToUsers(userIds: string[], event: string, data: any): Promise<void> {
    try {
      for (const userId of userIds) {
        await this.sendToUser(userId, event, data);
      }
    } catch (error) {
      logger.error(`Error sending event to users: ${(error as Error).message}`);
    }
  }

  async broadcastToAll(event: string, data: any): Promise<void> {
    try {
      this.io.emit(event, data);
      logger.debug(`Broadcast event: ${event}`);
    } catch (error) {
      logger.error(`Error broadcasting: ${(error as Error).message}`);
    }
  }

  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets ? sockets.size > 0 : false;
  }

  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  getIOServer(): SocketIOServer {
    return this.io;
  }
}