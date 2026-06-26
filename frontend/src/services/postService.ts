import { apiClient } from './api';
import { MediaItem } from './mediaService';

export type Visibility = 'PUBLIC' | 'FRIENDS' | 'NEARBY' | 'PRIVATE';

export interface PostMediaItem {
  order: number;
  media: MediaItem;
}

export interface Post {
  id:        string;
  userId:    string;
  caption:   string | null;
  visibility: Visibility;
  latitude:  number | null;
  longitude: number | null;
  likesCount: number;
  likes:     string[];
  postMedia: PostMediaItem[];
  createdAt: string;
  updatedAt: string;
}

export interface FeedPage {
  posts:      Post[];
  nextCursor: string | null;
  hasMore:    boolean;
}

export interface Comment {
  id:         string;
  parentId:   string;
  parentType: 'post' | 'cration';
  userId:     string;
  text:       string;
  createdAt:  string;
}

export interface CreatePostPayload {
  caption?:   string;
  visibility: Visibility;
  latitude?:  number;
  longitude?: number;
  mediaIds:   string[];
}

const postService = {
  createPost: (payload: CreatePostPayload) =>
    apiClient.post<Post>('/posts', payload).then(r => r.data),

  getPost: (id: string) =>
    apiClient.get<Post>(`/posts/${id}`).then(r => r.data),

  // Cursor-based feeds
  getFeed: (cursor?: string, limit = 20) =>
    apiClient.get<FeedPage>('/posts/feed', { params: { cursor, limit } }).then(r => r.data),

  getFriendsFeed: (cursor?: string, limit = 20) =>
    apiClient.get<FeedPage>('/posts/feed/friends', { params: { cursor, limit } }).then(r => r.data),

  getNearbyFeed: (latitude: number, longitude: number, radius = 50, cursor?: string, limit = 20) =>
    apiClient.get<FeedPage>('/posts/feed/nearby', { params: { latitude, longitude, radius, cursor, limit } }).then(r => r.data),

  getReelsFeed: (cursor?: string, limit = 20) =>
    apiClient.get<FeedPage>('/posts/reels', { params: { cursor, limit } }).then(r => r.data),

  getUserPosts: (userId: string, cursor?: string, limit = 20) =>
    apiClient.get<FeedPage>(`/posts/user/${userId}`, { params: { cursor, limit } }).then(r => r.data),

  deletePost: (id: string) =>
    apiClient.delete(`/posts/${id}`).then(r => r.data),

  likePost: (id: string) =>
    apiClient.post<Post>(`/posts/${id}/like`).then(r => r.data),

  unlikePost: (id: string) =>
    apiClient.delete<Post>(`/posts/${id}/like`).then(r => r.data),

  getComments: (postId: string, limit = 50) =>
    apiClient.get<{ comments: Comment[] }>(`/posts/${postId}/comments`, { params: { limit } }).then(r => r.data.comments),

  addComment: (postId: string, text: string) =>
    apiClient.post<Comment>(`/posts/${postId}/comments`, { text }).then(r => r.data),

  deleteComment: (postId: string, commentId: string) =>
    apiClient.delete(`/posts/${postId}/comments/${commentId}`),

  // Helpers
  getPrimaryMedia: (post: Post): PostMediaItem | undefined =>
    post.postMedia?.sort((a, b) => a.order - b.order)[0],

  isLiked: (post: Post, userId: string): boolean =>
    Array.isArray(post.likes) && post.likes.includes(userId),
};

export default postService;
