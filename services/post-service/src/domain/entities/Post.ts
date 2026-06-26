export type PostVisibility = 'public' | 'private' | 'nearby';

export interface PostLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  mediaUrls: string[];
  visibility: PostVisibility;
  nearbyRadius?: number; // km — only when visibility='nearby'
  location?: PostLocation;  // author's location at post time — required for nearby posts
  likes: string[];
  likesCount: number;
  createdAt: Date;
  updatedAt: Date;
}
