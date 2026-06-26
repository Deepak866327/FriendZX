import React, { createContext, useState, useCallback, useEffect } from 'react';
import { Notification } from '@/types/api';
import { notificationService } from '@/services/notificationService';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Logger } from '@/utils/logger';

const logger = new Logger('NotificationContext');

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  addNotification: (notification: Notification) => void;
  clearError: () => void;
}

export const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { on, off } = useWebSocket();

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await notificationService.getNotifications({ limit: 50 });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notifications');
      logger.error('Failed to fetch notifications', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true, readAt: new Date() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      logger.error('Failed to mark as read', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err: any) {
      logger.error('Failed to mark all as read', err);
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err: any) {
      logger.error('Failed to delete notification', err);
    }
  }, []);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.read) {
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Listen for real-time notifications — re-fetch from server so IDs are real Redis IDs
  useEffect(() => {
    const handleNotification = () => {
      fetchNotifications();
    };

    on('notification:received', handleNotification);

    return () => {
      off('notification:received', handleNotification);
    };
  }, [on, off, fetchNotifications]);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
    clearError,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};