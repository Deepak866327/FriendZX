import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { BT_WS_PATH } from '@/utils/constants';
import { storage } from '@/utils/storage';

export interface BtUser {
  userId: string;
  displayName: string;
  avatarInitial: string;
  distanceM: number;
  noGps?: boolean;
  bluetoothPaired?: boolean;
}

export interface BluetoothContextType {
  isDiscovering: boolean;
  isConnected: boolean;
  isBluetoothMode: boolean;   // true when in BT pairing/BLE mode (no GPS)
  bleScanActive: boolean;     // true when browser BLE scan is running
  nearbyUsers: BtUser[];
  pairingCode: string | null; // user's own code to share
  pairError: string | null;
  startDiscovery: (radiusM?: number) => void;
  stopDiscovery: () => void;
  updateBeacon: (lat: number, lng: number) => void;
  submitPairingCode: (code: string) => void;
  refreshPairingCode: () => void;
  clearPairError: () => void;
}

const BluetoothContext = createContext<BluetoothContextType | null>(null);

// Interval for BT-mode heartbeat (no GPS)
const BT_BEACON_INTERVAL = 20_000;
// How often to batch and send BLE scan results
const BLE_REPORT_INTERVAL = 8_000;

export const BluetoothProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef      = useRef<Socket | null>(null);
  const bleScanRef     = useRef<any | null>(null);  // BluetoothLEScan object
  const bleDevicesRef  = useRef<Set<string>>(new Set());
  const heartbeatRef   = useRef<ReturnType<typeof setInterval>>();
  const bleReportRef   = useRef<ReturnType<typeof setInterval>>();

  const [isConnected,     setIsConnected]     = useState(false);
  const [isDiscovering,   setIsDiscovering]   = useState(false);
  const [isBluetoothMode, setIsBluetoothMode] = useState(false);
  const [bleScanActive,   setBleScanActive]   = useState(false);
  const [nearbyUsers,     setNearbyUsers]     = useState<BtUser[]>([]);
  const [pairingCode,     setPairingCode]     = useState<string | null>(null);
  const [pairError,       setPairError]       = useState<string | null>(null);

  const radiusRef = useRef(50);

  // ── BLE scan (experimental Chrome API) ───────────────────────────────────────
  const startBleScan = useCallback(async () => {
    const bt = (navigator as any).bluetooth;
    if (!bt || typeof bt.requestLEScan !== 'function') return false;
    try {
      const scan = await bt.requestLEScan({ acceptAllAdvertisements: true, keepRepeatedDevices: false });
      scan.addEventListener('advertisementreceived', (e: any) => {
        if (e.device?.id) bleDevicesRef.current.add(e.device.id);
      });
      bleScanRef.current = scan;
      setBleScanActive(true);
      return true;
    } catch {
      return false; // permission denied or unsupported
    }
  }, []);

  const stopBleScan = useCallback(() => {
    try { bleScanRef.current?.stop(); } catch {}
    bleScanRef.current = null;
    bleDevicesRef.current.clear();
    clearInterval(bleReportRef.current);
    setBleScanActive(false);
  }, []);

  // ── Socket setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const userId = storage.getUser()?.id;
    if (!userId) return;

    const socket = io({
      path: BT_WS_PATH,
      query: { userId },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    });

    socket.on('connect',    () => setIsConnected(true));
    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsDiscovering(false);
      setIsBluetoothMode(false);
      setPairingCode(null);
      clearInterval(heartbeatRef.current);
      stopBleScan();
    });

    socket.on('bt:nearby-list', (data: { users: BtUser[] }) => {
      setNearbyUsers(data.users || []);
    });

    socket.on('bt:user-found', (user: BtUser) => {
      setNearbyUsers(prev => {
        const idx = prev.findIndex(u => u.userId === user.userId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = user;
          return next;
        }
        // GPS users sorted by distance; BT users appended
        if (user.noGps) return [...prev, user];
        return [...prev, user].sort(
          (a, b) => (a.noGps ? 1 : 0) - (b.noGps ? 1 : 0) || a.distanceM - b.distanceM
        );
      });
    });

    socket.on('bt:user-lost', (data: { userId: string }) => {
      setNearbyUsers(prev => prev.filter(u => u.userId !== data.userId));
    });

    // Server sends back the pairing code after bt:start or bt:refresh-token
    socket.on('bt:token', (data: { token: string }) => {
      setPairingCode(data.token);
    });

    socket.on('bt:pair-error', (data: { message: string }) => {
      setPairError(data.message);
    });

    socket.on('bt:stopped', () => {
      setIsDiscovering(false);
      setIsBluetoothMode(false);
      setPairingCode(null);
      setNearbyUsers([]);
      clearInterval(heartbeatRef.current);
      stopBleScan();
    });

    socketRef.current = socket;
    return () => {
      clearInterval(heartbeatRef.current);
      clearInterval(bleReportRef.current);
      stopBleScan();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [stopBleScan]);

  // ── startDiscovery ────────────────────────────────────────────────────────────
  const startDiscovery = useCallback((radiusM = 50) => {
    radiusRef.current = radiusM;
    const user = storage.getUser();
    const displayName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : user?.email || 'Unknown';

    const startGpsMode = (lat: number, lng: number) => {
      socketRef.current?.emit('bt:start', { latitude: lat, longitude: lng, radiusM, displayName });
      setIsBluetoothMode(false);
      setIsDiscovering(true);
    };

    const startBluetoothMode = async () => {
      socketRef.current?.emit('bt:start', { noGps: true, radiusM, displayName });
      setIsBluetoothMode(true);
      setIsDiscovering(true);

      // Try the Web Bluetooth BLE scan API
      const bleStarted = await startBleScan();
      if (bleStarted) {
        // Periodically report collected BLE devices to the server for fingerprint matching
        clearInterval(bleReportRef.current);
        bleReportRef.current = setInterval(() => {
          const devices = [...bleDevicesRef.current];
          if (devices.length > 0 && socketRef.current) {
            socketRef.current.emit('bt:ble-scan', { devices });
          }
        }, BLE_REPORT_INTERVAL);
      }

      // Heartbeat: keeps server-side TTLs alive; also piggybacks BLE devices
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        const bleDevices = [...bleDevicesRef.current];
        socketRef.current?.emit('bt:beacon', {
          noGps: true,
          ...(bleDevices.length > 0 ? { bleDevices } : {}),
        });
      }, BT_BEACON_INTERVAL);
    };

    if (!navigator.geolocation) {
      startBluetoothMode();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => startGpsMode(pos.coords.latitude, pos.coords.longitude),
      () => startBluetoothMode(),  // GPS denied → Bluetooth mode
    );
  }, [startBleScan]);

  // ── stopDiscovery ─────────────────────────────────────────────────────────────
  const stopDiscovery = useCallback(() => {
    clearInterval(heartbeatRef.current);
    clearInterval(bleReportRef.current);
    stopBleScan();
    socketRef.current?.emit('bt:stop');
    setIsDiscovering(false);
    setIsBluetoothMode(false);
    setPairingCode(null);
    setNearbyUsers([]);
  }, [stopBleScan]);

  // ── GPS beacon (called by BluetoothDiscovery when watchPosition fires) ────────
  const updateBeacon = useCallback((lat: number, lng: number) => {
    if (!isDiscovering || isBluetoothMode) return;
    socketRef.current?.emit('bt:beacon', { latitude: lat, longitude: lng });
  }, [isDiscovering, isBluetoothMode]);

  // ── Pairing code entry ────────────────────────────────────────────────────────
  const submitPairingCode = useCallback((code: string) => {
    if (!code.trim()) return;
    setPairError(null);
    socketRef.current?.emit('bt:use-token', { token: code.trim().toUpperCase() });
  }, []);

  const refreshPairingCode = useCallback(() => {
    socketRef.current?.emit('bt:refresh-token');
  }, []);

  const clearPairError = useCallback(() => setPairError(null), []);

  return (
    <BluetoothContext.Provider value={{
      isDiscovering,
      isConnected,
      isBluetoothMode,
      bleScanActive,
      nearbyUsers,
      pairingCode,
      pairError,
      startDiscovery,
      stopDiscovery,
      updateBeacon,
      submitPairingCode,
      refreshPairingCode,
      clearPairError,
    }}>
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = (): BluetoothContextType => {
  const ctx = useContext(BluetoothContext);
  if (!ctx) throw new Error('useBluetooth must be used within BluetoothProvider');
  return ctx;
};
