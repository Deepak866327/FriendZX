import { UserProfile, UserActivity, UserFollower, FollowingUser } from '../entities/UserProfile';

export interface IUserProfileRepository {
  // Profile Operations
  findById(userId: string): Promise<UserProfile | null>;
  create(profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile>;
  update(userId: string, profile: Partial<UserProfile>): Promise<UserProfile>;
  delete(userId: string): Promise<boolean>;

  // Activity Operations
  getActivity(userId: string, limit: number, offset: number): Promise<UserActivity[]>;
  addActivity(activity: Omit<UserActivity, 'id' | 'createdAt'>): Promise<UserActivity>;

  // Follow Operations
  follow(userId: string, followerId: string): Promise<UserFollower>;
  unfollow(userId: string, followerId: string): Promise<boolean>;
  isFollowing(userId: string, followerId: string): Promise<boolean>;
  getFollowers(userId: string, limit: number, offset: number): Promise<UserFollower[]>;
  getFollowing(userId: string, limit: number, offset: number): Promise<FollowingUser[]>;
  getFollowerCount(userId: string): Promise<number>;
  getFollowingCount(userId: string): Promise<number>;

  // Search
  searchByInterests(interests: string[], limit: number): Promise<UserProfile[]>;
  searchByLocation(location: string, limit: number): Promise<UserProfile[]>;
  searchUsers(query: string, limit: number): Promise<UserProfile[]>;
  discoverUsers(limit: number): Promise<UserProfile[]>;
}