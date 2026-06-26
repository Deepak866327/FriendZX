export interface UserProfile {
  id: string;
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
  friends: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserActivity {
  id: string;
  userId: string;
  activityType: 'profile_update' | 'follow' | 'unfollow' | 'photo_upload';
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface UserFollower {
  id: string;
  userId: string;
  followerId: string;
  createdAt: Date;
}

export interface FollowingUser {
  id: string;
  userId: string;
  followingId: string;
  createdAt: Date;
}