export interface CreateNotificationDTO {
  userId: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, any>;
}

export interface NotificationResponseDTO {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, any>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface NotificationListDTO {
  notifications: NotificationResponseDTO[];
  unreadCount: number;
  total: number;
}