import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { Logger } from '../../../../shared/utils/logger';

const logger = new Logger('BluetoothService');

// ── Redis key constants ───────────────────────────────────────────────────────
export const BT_GEO_KEY  = 'bt:geo';
export const BT_DISC_KEY = 'bt:discovering';

export const BT_TOKEN_TTL_S = 300;
export const BT_SCAN_TTL_S  = 45;
export const BT_DISC_TTL_S  = 300;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generates a 6-char pairing code using unambiguous characters (no 0/O/1/I). */
export function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function buildUserObj(uid: string, presence: any, distanceM: number, isBluetooth: boolean) {
  return {
    userId: uid,
    displayName: presence.displayName || uid.slice(0, 8),
    avatarInitial: (presence.displayName || uid).charAt(0).toUpperCase(),
    distanceM,
    noGps: isBluetooth,
    bluetoothPaired: isBluetooth,
  };
}

// ── GPS-based nearby lookup ───────────────────────────────────────────────────

export async function getGpsNearby(
  redis: Redis,
  userId: string,
  radiusM: number,
): Promise<any[]> {
  try {
    const raw = await redis.georadiusbymember(
      BT_GEO_KEY, userId, radiusM, 'm',
      'WITHCOORD', 'WITHDIST', 'COUNT', 50, 'ASC',
    ) as any[];

    const results: any[] = [];
    for (const entry of raw) {
      const memberId = entry[0] as string;
      if (memberId === userId) continue;
      const dist = parseFloat(entry[1] as string);
      const presenceRaw = await redis.get(`bt:presence:${memberId}`);
      const presence = presenceRaw ? JSON.parse(presenceRaw) : {};
      results.push({
        userId: memberId,
        distanceM: Math.round(dist),
        displayName: presence.displayName || memberId.slice(0, 8),
        avatarInitial: (presence.displayName || memberId).charAt(0).toUpperCase(),
        noGps: false,
      });
    }
    return results;
  } catch (err) {
    logger.error(`getGpsNearby error: ${(err as Error).message}`);
    return [];
  }
}

// ── BLE fingerprint matching ──────────────────────────────────────────────────
// Users who see ≥2 of the same BLE devices are considered nearby.

export async function findBleMatches(
  redis: Redis,
  io: SocketIOServer,
  userId: string,
  deviceIds: string[],
): Promise<void> {
  try {
    const discoverers = await redis.zrangebyscore(BT_DISC_KEY, '-inf', '+inf');
    const myPresence  = JSON.parse((await redis.get(`bt:presence:${userId}`)) || '{}');

    for (const peerId of discoverers) {
      if (peerId === userId) continue;
      const raw = await redis.get(`bt:blescan:${peerId}`);
      if (!raw) continue;
      const peerDevices: string[] = JSON.parse(raw);
      const peerSet = new Set(peerDevices);
      const intersection = deviceIds.filter(d => peerSet.has(d)).length;
      if (intersection < 2) continue;
      const union = new Set([...deviceIds, ...peerDevices]).size;
      if (intersection / union < 0.2) continue;

      const peerPresence = JSON.parse((await redis.get(`bt:presence:${peerId}`)) || '{}');
      io.to(`bt:user:${userId}`).emit('bt:user-found', buildUserObj(peerId, peerPresence, 0, true));
      io.to(`bt:user:${peerId}`).emit('bt:user-found', buildUserObj(userId, myPresence,  0, true));
      logger.debug(`BLE match: ${userId} ↔ ${peerId} (${intersection}/${union} devices)`);
    }
  } catch (err) {
    logger.error(`findBleMatches error: ${(err as Error).message}`);
  }
}

// ── Cleanup on disconnect / stop ─────────────────────────────────────────────

export async function cleanupBtUser(
  redis: Redis,
  io: SocketIOServer,
  userId: string,
  defaultRadiusM: number,
): Promise<void> {
  try {
    const presenceRaw = await redis.get(`bt:presence:${userId}`);
    if (presenceRaw) {
      const presence = JSON.parse(presenceRaw);
      if (!presence.noGps) {
        const nearby = await getGpsNearby(redis, userId, presence.radiusM || defaultRadiusM);
        await redis.zrem(BT_GEO_KEY, userId);
        for (const peer of nearby) {
          io.to(`bt:user:${peer.userId}`).emit('bt:user-lost', { userId });
        }
      } else {
        const discoverers = await redis.zrangebyscore(BT_DISC_KEY, '-inf', '+inf');
        for (const peerId of discoverers) {
          if (peerId !== userId) io.to(`bt:user:${peerId}`).emit('bt:user-lost', { userId });
        }
      }
    }

    const myToken = await redis.get(`bt:mytoken:${userId}`);
    if (myToken) await redis.del(`bt:token:${myToken}`);

    await Promise.all([
      redis.del(`bt:presence:${userId}`),
      redis.del(`bt:blescan:${userId}`),
      redis.del(`bt:mytoken:${userId}`),
      redis.zrem(BT_DISC_KEY, userId),
    ]);
  } catch (err) {
    logger.error(`cleanupBtUser error for ${userId}: ${(err as Error).message}`);
  }
}
