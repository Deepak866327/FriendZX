import { apiClient } from './api';
import { NotificationList, Notification } from '@/types/api';
import { PaginationParams } from '@/types/models';

export const notificationService = {
  // Get notifications
  getNotifications: async (params?: PaginationParams): Promise<NotificationList> => {
    const response = await apiClient.get<NotificationList>('/notifications', {
      params,
    });
    return response.data;
  },

  // Mark notification as read
  markAsRead: async (notificationId: string): Promise<Notification> => {
    const response = await apiClient.post<Notification>(
      `/notifications/${notificationId}/read`
    );
    return response.data;
  },

  // Mark all as read
  markAllAsRead: async (): Promise<any> => {
    const response = await apiClient.post('/notifications/read/all');
    return response.data;
  },

  // Get unread count
  getUnreadCount: async (): Promise<number> => {
    const response = await apiClient.get<{ count: number }>(
      '/notifications/unread/count'
    );
    return response.data.count;
  },

  // Delete notification
  deleteNotification: async (notificationId: string): Promise<void> => {
    await apiClient.delete(`/notifications/${notificationId}`);
  },
};