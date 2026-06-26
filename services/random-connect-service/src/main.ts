import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { RedisCache, RedisGeoCache } from '../../../shared/utils/RedisCache';
import { Logger } from '../../../shared/utils/logger';

dotenv.config();

const app    = express();
const server = http.createServer(app);
const logger = new Logger('RandomConnectService');
const PORT   = process.env.PORT || 3007;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const redis   = new RedisCache(process.env.REDIS_URL);
const roomGeo = new RedisGeoCache(process.env.REDIS_URL);

const ROOM_TTL  = 60 * 60 * 2; // 2 hours
const QUEUE_TTL = 60 * 30;     // 30 min

// ── Socket.IO ───────────────────────────────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.SOCKET_IO_CORS?.split(',') || '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// userId → socketId map for direct emit
const userSockets = new Map<string, string>();

// ── REST auth middleware ────────────────────────────────────────────────────
const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  (req as any).userId = userId;
  next();
};

// ══════════════════════════════════════════════════════
//  REST — Nearby Rooms
// ══════════════════════════════════════════════════════

app.post('/rooms', auth, async (req, res) => {
  const userId = (req as any).userId;
  const { latitude, longitude, radius = 10, title = '', creatorName = '' } = req.body;
  if (latitude == null || longitude == null)
    return res.status(400).json({ error: 'latitude and longitude required' });

  const roomId = randomUUID();
  const room = {
    id: roomId,
    creatorId: userId,
    creatorName,
    title: (title as string).trim() || 'Random Video Chat',
    latitude:  parseFloat(latitude),
    longitude: parseFloat(longitude),
    radius:    Math.min(parseFloat(radius) || 10, 50),
    participants:     [userId],
    participantNames: { [userId]: creatorName },
    createdAt: new Date().toISOString(),
  };
  try {
    await redis.set(`vroom:${roomId}`, room, ROOM_TTL);
    await roomGeo.addLocation('vrooms:geo', parseFloat(longitude), parseFloat(latitude), roomId);
    res.status(201).json(room);
  } catch (err) {
    logger.error(`Create room: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.get('/rooms/nearby', auth, async (req, res) => {
  const { latitude, longitude, radius = 50 } = req.query;
  if (!latitude || !longitude)
    return res.status(400).json({ error: 'latitude and longitude required' });
  try {
    const ids = await roomGeo.findNearby(
      'vrooms:geo',
      parseFloat(longitude as string),
      parseFloat(latitude  as string),
      parseFloat(radius    as string),
      'km'
    );
    const rooms = [];
    for (const id of ids) {
      const r = await redis.get<any>(`vroom:${id}`);
      if (r) rooms.push(r);
    }
    res.json(rooms);
  } catch (err) {
    logger.error(`Nearby rooms: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

app.post('/rooms/:roomId/join', auth, async (req, res) => {
  const userId = (req as any).userId;
  const { roomId } = req.params;
  const { displayName = '' } = req.body;
  const room = await redis.get<any>(`vroom:${roomId}`);
  if (!room) return res.status(404).json({ error: 'Room not found or expired' });
  if (!room.participants.includes(userId)) {
    room.participants.push(userId);
    room.participantNames[userId] = displayName;
    await redis.set(`vroom:${roomId}`, room, ROOM_TTL);
  }
  res.json(room);
});

app.post('/rooms/:roomId/leave', auth, async (req, res) => {
  const userId = (req as any).userId;
  const { roomId } = req.params;
  const room = await redis.get<any>(`vroom:${roomId}`);
  if (!room) return res.json({ ok: true });
  room.participants = room.participants.filter((p: string) => p !== userId);
  delete room.participantNames[userId];
  if (room.participants.length === 0 || room.creatorId === userId) {
    await redis.del(`vroom:${roomId}`);
    await roomGeo.removeLocation('vrooms:geo', roomId);
  } else {
    await redis.set(`vroom:${roomId}`, room, ROOM_TTL);
  }
  res.json({ ok: true });
});

app.delete('/rooms/:roomId', auth, async (req, res) => {
  const userId = (req as any).userId;
  const { roomId } = req.params;
  const room = await redis.get<any>(`vroom:${roomId}`);
  if (!room) return res.json({ ok: true });
  if (room.creatorId !== userId) return res.status(403).json({ error: 'Only creator can close' });
  await redis.del(`vroom:${roomId}`);
  await roomGeo.removeLocation('vrooms:geo', roomId);
  res.json({ ok: true });
});

app.get('/health', (_req, res) => res.json({ status: 'Random Connect Service running' }));

// ══════════════════════════════════════════════════════
//  Queue helpers (stored as JSON array in Redis)
// ══════════════════════════════════════════════════════

async function getQueue(): Promise<string[]> {
  return (await redis.get<string[]>('rc:queue')) || [];
}

async function enqueueUser(userId: string): Promise<void> {
  const q = await getQueue();
  if (!q.includes(userId)) q.push(userId);
  await redis.set('rc:queue', q, QUEUE_TTL);
}

async function dequeueMatch(joiningUserId: string): Promise<string | null> {
  const q = await getQueue();
  const idx = q.findIndex(id => id !== joiningUserId);
  if (idx === -1) return null;
  const [matched] = q.splice(idx, 1);
  await redis.set('rc:queue', q, QUEUE_TTL);
  return matched;
}

async function removeFromQueue(userId: string): Promise<void> {
  const q = await getQueue();
  const filtered = q.filter(id => id !== userId);
  if (filtered.length !== q.length) await redis.set('rc:queue', filtered, QUEUE_TTL);
}

// ══════════════════════════════════════════════════════
//  Socket.IO connection handling
// ══════════════════════════════════════════════════════

io.on('connection', (socket: Socket) => {
  const userId = socket.handshake.query.userId as string;
  if (!userId) { socket.disconnect(); return; }

  userSockets.set(userId, socket.id);
  socket.join(`user:${userId}`);
  logger.info(`Connected: ${userId}`);

  // ── Disconnect ─────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    userSockets.delete(userId);
    logger.info(`Disconnected: ${userId}`);
    await removeFromQueue(userId);

    // Notify random-connect partner
    const match = await redis.get<any>(`rc:match:${userId}`);
    if (match?.partnerId) {
      io.to(`user:${match.partnerId}`).emit('randconn:partner-left');
      await redis.del(`rc:match:${match.partnerId}`);
    }
    await redis.del(`rc:match:${userId}`);
    await redis.del(`rc:user:${userId}`);
  });

  // ── Nearby Room Signaling ───────────────────────────────────────────────
  socket.on('room:join', (data: { roomId: string; displayName: string }) => {
    if (!data?.roomId) return;
    const key = `room:${data.roomId}`;
    socket.join(key);

    // Tell existing peers this user joined
    socket.to(key).emit('room:peer-joined', {
      peerId: userId, peerName: data.displayName || userId,
    });

    // Send the joiner the list of peers already in the room
    const roomSet = io.sockets.adapter.rooms.get(key);
    const existing: string[] = [];
    if (roomSet) {
      for (const sid of roomSet) {
        if (sid === socket.id) continue;
        for (const [uid, s] of userSockets) {
          if (s === sid) { existing.push(uid); break; }
        }
      }
    }
    socket.emit('room:current-peers', { peers: existing });
  });

  socket.on('room:leave', (data: { roomId: string }) => {
    if (!data?.roomId) return;
    socket.leave(`room:${data.roomId}`);
    socket.to(`room:${data.roomId}`).emit('room:peer-left', { peerId: userId });
  });

  socket.on('room:offer', (d: { roomId: string; toUserId: string; sdp: any }) => {
    if (!d?.toUserId) return;
    io.to(`user:${d.toUserId}`).emit('room:offer', { roomId: d.roomId, fromUserId: userId, sdp: d.sdp });
  });

  socket.on('room:answer', (d: { roomId: string; toUserId: string; sdp: any }) => {
    if (!d?.toUserId) return;
    io.to(`user:${d.toUserId}`).emit('room:answer', { roomId: d.roomId, fromUserId: userId, sdp: d.sdp });
  });

  socket.on('room:ice', (d: { roomId: string; toUserId: string; candidate: any }) => {
    if (!d?.toUserId) return;
    io.to(`user:${d.toUserId}`).emit('room:ice', { roomId: d.roomId, fromUserId: userId, candidate: d.candidate });
  });

  // ── Public Random Connect (1-on-1 matchmaking) ──────────────────────────
  socket.on('randconn:join', async (data: { displayName: string }) => {
    const name = data?.displayName || userId.slice(0, 8);
    await redis.set(`rc:user:${userId}`, { userId, displayName: name }, QUEUE_TTL);

    const partnerId = await dequeueMatch(userId);
    if (partnerId) {
      const partnerInfo = await redis.get<any>(`rc:user:${partnerId}`);
      const partnerName = partnerInfo?.displayName || partnerId.slice(0, 8);

      await redis.set(`rc:match:${userId}`,    { partnerId, partnerName },  QUEUE_TTL);
      await redis.set(`rc:match:${partnerId}`, { partnerId: userId, partnerName: name }, QUEUE_TTL);

      // Caller (joiner) sends the offer; callee (waiter) answers
      io.to(`user:${userId}`)   .emit('randconn:matched', { partnerId, partnerName, role: 'caller' });
      io.to(`user:${partnerId}`).emit('randconn:matched', { partnerId: userId, partnerName: name, role: 'callee' });
      logger.info(`Matched: ${userId} ↔ ${partnerId}`);
    } else {
      await enqueueUser(userId);
      socket.emit('randconn:waiting');
      logger.info(`Waiting: ${userId}`);
    }
  });

  socket.on('randconn:leave', async () => {
    await removeFromQueue(userId);
    const match = await redis.get<any>(`rc:match:${userId}`);
    if (match?.partnerId) {
      io.to(`user:${match.partnerId}`).emit('randconn:partner-left');
      await redis.del(`rc:match:${match.partnerId}`);
    }
    await redis.del(`rc:match:${userId}`);
    await redis.del(`rc:user:${userId}`);
  });

  socket.on('randconn:offer', (d: { toUserId: string; sdp: any }) => {
    if (!d?.toUserId) return;
    io.to(`user:${d.toUserId}`).emit('randconn:offer', { fromUserId: userId, sdp: d.sdp });
  });

  socket.on('randconn:answer', (d: { toUserId: string; sdp: any }) => {
    if (!d?.toUserId) return;
    io.to(`user:${d.toUserId}`).emit('randconn:answer', { fromUserId: userId, sdp: d.sdp });
  });

  socket.on('randconn:ice', (d: { toUserId: string; candidate: any }) => {
    if (!d?.toUserId) return;
    io.to(`user:${d.toUserId}`).emit('randconn:ice', { fromUserId: userId, candidate: d.candidate });
  });
});

server.listen(PORT, () => logger.info(`Random Connect Service running on port ${PORT}`));
