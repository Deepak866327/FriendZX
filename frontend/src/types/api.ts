export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string; // no longer in the body — lives in an HttpOnly cookie
  user: User;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  profilePicture?: string;
  phone?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  location?: string;
  interests: string[];
  photos: string[];
  followers: number;
  following: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicProfile {
  userId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  location?: string;
  interests: string[];
  photos: string[];
  followers: number;
  following: number;
  friends?: number;
}

export type CallType = 'audio' | 'video';

export type CallStatus =
  | 'requesting'
  | 'ringing-outgoing'
  | 'ringing-incoming'
  | 'connecting'
  | 'active';

export interface CallState {
  callId: string;
  peerId: string;
  peerName: string;
  callType: CallType;
  status: CallStatus;
  isOutgoing: boolean;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
}

export interface IncomingCallRequest {
  callId: string;
  fromUserId: string;
  fromName: string;
  callType: CallType;
}

export interface RelationshipStatus {
  isFollowing: boolean;
  isFollower: boolean;
  isMutual: boolean;
}

export interface ConversationEntry {
  partnerId: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export type ChatMsgType = 'text' | 'image' | 'video' | 'voice';

export interface ChatAttachment {
  attachmentId: string;
  url: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;   // voice note length in seconds
}

export interface ChatMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  type: ChatMsgType;
  encrypted?: boolean;
  iv?: string;
  attachment?: ChatAttachment;
  timestamp: string;
  read: boolean;
  deleted?: boolean;
  // client-only: decrypted text (not persisted)
  _decrypted?: string;
}

export interface LocationData {
  userId: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NearbyUser {
  userId: string;
  distance: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  lastUpdated: Date;
}

export interface Notification {
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

export interface NotificationList {
  notifications: Notification[];
  unreadCount: number;
  total: number;
}

export interface UserActivity {
  id: string;
  userId: string;
  activityType: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}