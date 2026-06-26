export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  phone?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  userId: string;
  bio?: string;
  location?: string;
  interests: string[];
  photos: string[];
  followers: number;
  following: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  userId: string;
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
  timestamp: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: Date;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface KafkaMessage {
  id: string;
  type: string;
  payload: any;
  timestamp: Date;
  source: string;
}
