import { Server as SocketIOServer, Socket } from 'socket.io';
import Redis from 'ioredis';
import { KafkaProducer } from '../../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../../shared/utils/logger';
import {
  BT_GEO_KEY, BT_DISC_KEY,
  BT_TOKEN_TTL_S, BT_SCAN_TTL_S, BT_DISC_TTL_S,
  generatePairingCode, buildUserObj,
  getGpsNearby, findBleMatches, cleanupBtUser,
} from './BluetoothService';

const logger = new Logger('BluetoothSocket');

export interface BtConfig {
  maxRadiusM: number;
  defaultRadiusM: number;
  presenceTtlS: number;
}

/**
 * Attach all Bluetooth Socket.IO event handlers to the given server.
 * Returns the userSockets map so the REST router can read active user count.
 */
export function initBluetoothSocket(
  io: SocketIOServer,
  redis: Redis,
  kafka: KafkaProducer,
  config: BtConfig,
): Map<string, Set<string>> {
  const { maxRadiusM, defaultRadiusM, presenceTtlS } = config;

  // userId → Set of socketIds (multiple tabs / reconnects)
  const userSockets = new Map<string, Set<string>>();

  io.on('connection', async (socket: Socket) => {
    const userId = socket.handshake.query.userId as string;
    if (!userId) { socket.disconnect(); return; }

    logger.info(`BT connected: ${userId} (${socket.id})`);
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);

    // Each user joins a named room for targeted emit
    socket.join(`bt:user:${userId}`);
    socket.emit('bt:connected', { message: 'Bluetooth service connected', userId });

    // ── bt:start — begin discovery ──────────────────────────────────────────
    socket.on('bt:start', async (data: {
      latitude?: number;
      longitude?: number;
      radiusM?: number;
      displayName?: string;
      noGps?: boolean;
    }) => {
      const hasGps     = typeof data?.latitude === 'number' && typeof data?.longitude === 'number';
      const radiusM    = Math.min(data.radiusM ?? defaultRadiusM, maxRadiusM);
      const displayName = data.displayName || userId.slice(0, 8);

      if (hasGps) {
        // GPS mode
        const presence = { userId, displayName, radiusM, lastSeen: Date.now(), noGps: false };
        try {
          await redis.geoadd(BT_GEO_KEY, data.longitude!, data.latitude!, userId);
          await redis.setex(`bt:presence:${userId}`, presenceTtlS, JSON.stringify(presence));

          const nearby = await getGpsNearby(redis, userId, radiusM);
          socket.emit('bt:nearby-list', { users: nearby, noGps: false });

          for (const peer of nearby) {
            if (!(await redis.get(`bt:presence:${peer.userId}`))) continue;
            io.to(`bt:user:${peer.userId}`).emit('bt:user-found', {
              userId, displayName,
              avatarInitial: displayName.charAt(0).toUpperCase(),
              distanceM: peer.distanceM,
              noGps: false,
            });
          }

          await kafka.publish('bt.user.appeared', {
            userId, latitude: data.latitude, longitude: data.longitude, nearbyCount: nearby.length,
          }).catch(() => {});
        } catch (err) {
          logger.error(`bt:start GPS error: ${(err as Error).message}`);
        }
      } else {
        // Bluetooth proximity mode
        const presence = { userId, displayName, radiusM, lastSeen: Date.now(), noGps: true };
        try {
          await redis.setex(`bt:presence:${userId}`, BT_TOKEN_TTL_S, JSON.stringify(presence));
          await redis.zadd(BT_DISC_KEY, Date.now(), userId);
          await redis.expire(BT_DISC_KEY, BT_DISC_TTL_S);

          const code = generatePairingCode();
          await redis.setex(`bt:token:${code}`,     BT_TOKEN_TTL_S, userId);
          await redis.setex(`bt:mytoken:${userId}`, BT_TOKEN_TTL_S, code);

          socket.emit('bt:token', { token: code, expiresInS: BT_TOKEN_TTL_S });
          socket.emit('bt:nearby-list', { users: [], noGps: true });

          await kafka.publish('bt.user.appeared', { userId, noGps: true, nearbyCount: 0 }).catch(() => {});
        } catch (err) {
          logger.error(`bt:start BT error: ${(err as Error).message}`);
        }
      }
    });

    // ── bt:use-token — manual pairing via code ──────────────────────────────
    socket.on('bt:use-token', async (data: { token: string }) => {
      if (!data?.token) return;
      const code   = data.token.toUpperCase().replace(/\s/g, '');
      const peerId = await redis.get(`bt:token:${code}`);

      if (!peerId) {
        socket.emit('bt:pair-error', { message: 'Code not found or expired. Ask them to refresh.' });
        return;
      }
      if (peerId === userId) {
        socket.emit('bt:pair-error', { message: 'That is your own code!' });
        return;
      }

      const myPresence   = JSON.parse((await redis.get(`bt:presence:${userId}`)) || '{}');
      const peerPresence = JSON.parse((await redis.get(`bt:presence:${peerId}`))  || '{}');

      socket.emit('bt:user-found', buildUserObj(peerId, peerPresence, 0, true));
      io.to(`bt:user:${peerId}`).emit('bt:user-found', buildUserObj(userId, myPresence, 0, true));
      logger.info(`BT paired via code: ${userId} ↔ ${peerId}`);
    });

    // ── bt:ble-scan — BLE device fingerprint ────────────────────────────────
    socket.on('bt:ble-scan', async (data: { devices: string[] }) => {
      if (!Array.isArray(data?.devices) || data.devices.length === 0) return;
      try {
        await redis.setex(`bt:blescan:${userId}`, BT_SCAN_TTL_S, JSON.stringify(data.devices));
        await findBleMatches(redis, io, userId, data.devices);
      } catch (err) {
        logger.error(`bt:ble-scan error: ${(err as Error).message}`);
      }
    });

    // ── bt:refresh-token — request a new pairing code ───────────────────────
    socket.on('bt:refresh-token', async () => {
      try {
        const oldToken = await redis.get(`bt:mytoken:${userId}`);
        if (oldToken) await redis.del(`bt:token:${oldToken}`);

        const code = generatePairingCode();
        await redis.setex(`bt:token:${code}`,     BT_TOKEN_TTL_S, userId);
        await redis.setex(`bt:mytoken:${userId}`, BT_TOKEN_TTL_S, code);

        const presRaw = await redis.get(`bt:presence:${userId}`);
        if (presRaw) {
          const p = JSON.parse(presRaw);
          p.lastSeen = Date.now();
          await redis.setex(`bt:presence:${userId}`, BT_TOKEN_TTL_S, JSON.stringify(p));
        }
        await redis.zadd(BT_DISC_KEY, Date.now(), userId);
        socket.emit('bt:token', { token: code, expiresInS: BT_TOKEN_TTL_S });
      } catch (err) {
        logger.error(`bt:refresh-token error: ${(err as Error).message}`);
      }
    });

    // ── bt:beacon — periodic TTL refresh + GPS re-scan ──────────────────────
    socket.on('bt:beacon', async (data: {
      latitude?: number;
      longitude?: number;
      noGps?: boolean;
      bleDevices?: string[];
    }) => {
      const presenceRaw = await redis.get(`bt:presence:${userId}`);
      if (!presenceRaw) return;

      const presence = JSON.parse(presenceRaw);
      presence.lastSeen = Date.now();

      if (presence.noGps) {
        try {
          await redis.setex(`bt:presence:${userId}`, BT_TOKEN_TTL_S, JSON.stringify(presence));
          await redis.zadd(BT_DISC_KEY, Date.now(), userId);

          const myToken = await redis.get(`bt:mytoken:${userId}`);
          if (myToken) {
            await redis.expire(`bt:token:${myToken}`, BT_TOKEN_TTL_S);
            await redis.expire(`bt:mytoken:${userId}`, BT_TOKEN_TTL_S);
          }

          if (Array.isArray(data?.bleDevices) && data.bleDevices.length > 0) {
            await redis.setex(`bt:blescan:${userId}`, BT_SCAN_TTL_S, JSON.stringify(data.bleDevices));
            await findBleMatches(redis, io, userId, data.bleDevices);
          }
        } catch (err) {
          logger.error(`bt:beacon BT error: ${(err as Error).message}`);
        }
        return;
      }

      // GPS beacon
      if (typeof data?.latitude !== 'number' || typeof data?.longitude !== 'number') return;
      try {
        await redis.geoadd(BT_GEO_KEY, data.longitude, data.latitude, userId);
        await redis.setex(`bt:presence:${userId}`, presenceTtlS, JSON.stringify(presence));

        const nearby = await getGpsNearby(redis, userId, presence.radiusM);
        socket.emit('bt:nearby-list', { users: nearby, noGps: false });

        for (const peer of nearby) {
          io.to(`bt:user:${peer.userId}`).emit('bt:user-found', {
            userId,
            displayName: presence.displayName,
            avatarInitial: presence.displayName.charAt(0).toUpperCase(),
            distanceM: peer.distanceM,
            noGps: false,
          });
        }
      } catch (err) {
        logger.error(`bt:beacon GPS error: ${(err as Error).message}`);
      }
    });

    // ── bt:stop — stop discovery ────────────────────────────────────────────
    socket.on('bt:stop', async () => {
      await cleanupBtUser(redis, io, userId, defaultRadiusM);
      socket.emit('bt:stopped', {});
      await kafka.publish('bt.user.disappeared', { userId }).catch(() => {});
    });

    // ── disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      logger.info(`BT disconnected: ${userId} (${socket.id})`);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          await cleanupBtUser(redis, io, userId, defaultRadiusM);
        }
      }
    });
  });

  return userSockets;
}
