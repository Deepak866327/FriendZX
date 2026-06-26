import { Post, PostVisibility } from '../entities/Post';

export interface CreatePostInput {
  userId: string;
  content: string;
  mediaUrls: string[];
  visibility: PostVisibility;
  nearbyRadius?: number;
  location?: { latitude: number; longitude: number };
}

export interface FeedPage {
  posts: Post[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface IPostRepository {
  create(input: CreatePostInput): Promise<Post>;
  findById(id: string): Promise<Post | null>;
  findUserPosts(userId: string, viewerId: string, isFriend: boolean, page: number, limit: number): Promise<FeedPage>;
  findPublicFeed(page: number, limit: number): Promise<FeedPage>;
  findFriendsFeed(friendIds: string[], page: number, limit: number): Promise<FeedPage>;
  findNearbyFeed(latitude: number, longitude: number, page: number, limit: number): Promise<FeedPage>;
  like(postId: string, userId: string): Promise<Post | null>;
  unlike(postId: string, userId: string): Promise<Post | null>;
  delete(postId: string, userId: string): Promise<boolean>;
}
