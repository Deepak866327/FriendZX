import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_PATH } from '@/utils/constants';
import { storage } from '@/utils/storage';

interface SocketContextType {
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  emit: (event: string, data?: any) => void;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<Socket | null>(null);
  // Handlers registered by children before the socket is created (React fires children effects first)
  const pendingRef = useRef<Array<{ event: string; handler: (...args: any[]) => void }>>([]);
  const [isConnected, setIsConnected] = useState(false);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    } else {
      pendingRef.current.push({ event, handler });
    }
  }, []);

  const off = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler);
    } else {
      pendingRef.current = pendingRef.current.filter(
        p => !(p.event === event && p.handler === handler)
      );
    }
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  useEffect(() => {
    const userId = storage.getUser()?.id;
    if (!userId) return;

    const socket = io({
      path: WS_PATH,
      query: { userId },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Drain handlers that children registered before this socket existed
    pendingRef.current.forEach(({ event, handler }) => socket.on(event, handler));
    pendingRef.current = [];

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ on, off, emit, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
