import { apiClient } from './api';
import { storage } from '@/utils/storage';

export interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  text?: string;
  visibility: 'public' | 'friends' | 'nearby';
  viewers: string[];
  viewCount: number;
  createdAt: string;
  expiresAt: string;
  seen?: boolean;
}

export interface StoryGroup {
  userId: string;
  firstName?: string;
  lastName?: string;
  photo?: string;
  stories: Story[];
  hasUnseen: boolean;
}

const API_BASE = '/api';
export function resolveStoryMediaUrl(url: string) {
  if (url.startsWith('http')) return url;
  // /stories/uploads/file.jpg → /api/posts/stories/uploads/file.jpg
  if (url.startsWith('/stories/uploads/')) {
    return `${API_BASE}/posts${url}`;
  }
  return `${API_BASE}${url}`;
}

export const storyService = {
  createStory: async (payload: {
    media: File;
    text?: string;
    visibility: 'public' | 'friends' | 'nearby';
    nearbyRadius?: number;
    latitude?: number;
    longitude?: number;
  }, onProgress?: (pct: number) => void): Promise<Story> => {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('media', payload.media);
      form.append('text', payload.text || '');
      form.append('visibility', payload.visibility);
      if (payload.nearbyRadius != null) form.append('nearbyRadius', String(payload.nearbyRadius));
      if (payload.latitude != null)     form.append('latitude',     String(payload.latitude));
      if (payload.longitude != null)    form.append('longitude',    String(payload.longitude));

      const xhr = new XMLHttpRequest();
      const token = storage.getToken() || '';
      xhr.open('POST', '/api/posts/stories');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100)); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(JSON.parse(xhr.responseText)?.error || 'Upload failed'));
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(form);
    });
  },

  getFeed: async (latitude?: number, longitude?: number): Promise<StoryGroup[]> => {
    const params: any = {};
    if (latitude != null)  params.latitude  = latitude;
    if (longitude != null) params.longitude = longitude;
    const res = await apiClient.get<{ groups: StoryGroup[] }>('/posts/stories/feed', { params });
    return res.data.groups || [];
  },

  getUserStories: async (userId: string): Promise<Story[]> => {
    const res = await apiClient.get<{ stories: Story[] }>(`/posts/stories/user/${userId}`);
    return res.data.stories || [];
  },

  viewStory: async (storyId: string): Promise<void> => {
    await apiClient.post(`/posts/stories/${storyId}/view`).catch(() => {});
  },

  deleteStory: async (storyId: string): Promise<void> => {
    await apiClient.delete(`/posts/stories/${storyId}`);
  },
};
