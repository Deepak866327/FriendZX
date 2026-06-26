export interface UpdateProfileDTO {
  bio?: string;
  location?: string;
  interests?: string[];
  photos?: string[];
}

export interface ProfileResponseDTO {
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

export interface ActivityResponseDTO {
  id: string;
  userId: string;
  activityType: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface FollowResponseDTO {
  userId: string;
  followerId: string;
  isFollowing: boolean;
  message: string;
}