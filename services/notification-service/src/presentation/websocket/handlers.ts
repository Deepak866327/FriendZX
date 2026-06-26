import { Socket } from 'socket.io';
import { Logger } from '../../../../../shared/utils/logger';

const logger = new Logger('WebSocketHandlers');

export function setupWebSocketHandlers(socket: Socket) {
  // Handle notification acknowledgment
  socket.on('notification:ack', (data: { notificationId: string }) => {
    logger.debug(`Notification ack received: ${data.notificationId}`);
    socket.emit('notification:ack-received', { id: data.notificationId });
  });

  // Handle typing indicator
  socket.on('user:typing', (data: { targetUserId: string }) => {
    socket.to(`user:${data.targetUserId}`).emit('user:typing', {
      userId: socket.handshake.query.userId,
    });
  });

  // Handle presence update
  socket.on('user:online', () => {
    const userId = socket.handshake.query.userId;
    logger.debug(`User online: ${userId}`);
    socket.broadcast.emit('user:online', { userId });
  });

  socket.on('user:offline', () => {
    const userId = socket.handshake.query.userId;
    logger.debug(`User offline: ${userId}`);
    socket.broadcast.emit('user:offline', { userId });
  });
}