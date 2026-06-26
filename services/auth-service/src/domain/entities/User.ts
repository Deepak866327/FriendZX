export interface User {
  id: string;
  email: string;
  password: string | null;
  firstName: string;
  lastName: string;
  username?: string;
  phoneNumber?: string;
  googleId?: string;
  profilePicture?: string;
  phone?: string;
  isActive: boolean;
  isVerified?: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface JWTPayload {
  id: string;
  email: string;
  iat?: number;
  exp?: number;
}