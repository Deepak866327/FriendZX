export type NotificationType = 
  | 'user_registered'
  | 'user_followed'
  | 'user_unfollowed'
  | 'profile_updated'
  | 'nearby_user_found'
  | 'location_updated'
  | 'message_received'
  | 'system_alert'
  | 'match_found';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, any>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface NotificationEvent {
  id: string;
  type: NotificationType;
  userId: string;
  sourceUserId?: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  timestamp: Date;
}

export interface UserSocket {
  userId: string;
  socketId: string;
  connectedAt: Date;
}