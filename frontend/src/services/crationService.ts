import { apiClient } from './api';

export interface Cration {
  id:           string;
  userId:       string;
  caption:      string;
  videoUrl:     string;
  thumbnailUrl: string | null;
  visibility:   'public' | 'friends' | 'nearby';
  nearbyRadius?: number;
  likes:        string[];
  likesCount:    number;
  commentsCount: number;
  sharesCount:   number;
  views:         number;
  createdAt:    string;
}

export interface CrationPage {
  crations: Cration[];
  total:    number;
  page:     number;
  hasMore:  boolean;
}

const crationService = {
  create: (payload: {
    caption: string;
    video: File;
    thumbnail?: File | null;
    visibility?: string;
    nearbyRadius?: number;
    latitude?: number;
    longitude?: number;
  }) => {
    const form = new FormData();
    form.append('caption', payload.caption);
    form.append('video', payload.video);
    if (payload.thumbnail) form.append('thumbnail', payload.thumbnail);
    if (payload.visibility) form.append('visibility', payload.visibility);
    if (payload.nearbyRadius != null) form.append('nearbyRadius', String(payload.nearbyRadius));
    if (payload.latitude != null) form.append('latitude', String(payload.latitude));
    if (payload.longitude != null) form.append('longitude', String(payload.longitude));
    return apiClient.post<Cration>('/crations', form, { headers: { 'Content-Type': undefined } }).then(r => r.data);
  },

  getFeed: (page = 1, limit = 10) =>
    apiClient.get<CrationPage>(`/crations/feed?page=${page}&limit=${limit}`).then(r => r.data),

  getPublicFeed: (page = 1, limit = 10) =>
    apiClient.get<CrationPage>(`/crations/feed/public?page=${page}&limit=${limit}`).then(r => r.data),

  getFriendsFeed: (page = 1, limit = 10) =>
    apiClient.get<CrationPage>(`/crations/feed/friends?page=${page}&limit=${limit}`).then(r => r.data),

  getNearbyFeed: (lat: number, lng: number, page = 1, limit = 10, radius = 50) =>
    apiClient.get<CrationPage>(
      `/crations/feed/nearby?latitude=${lat}&longitude=${lng}&radius=${radius}&page=${page}&limit=${limit}`
    ).then(r => r.data),

  getUserCrations: (userId: string, page = 1, limit = 10) =>
    apiClient.get<CrationPage>(`/crations/user/${userId}?page=${page}&limit=${limit}`).then(r => r.data),

  like:   (id: string) => apiClient.post<Cration>(`/crations/${id}/like`).then(r => r.data),
  unlike: (id: string) => apiClient.delete<Cration>(`/crations/${id}/like`).then(r => r.data),
  view:   (id: string) => apiClient.post(`/crations/${id}/view`).then(r => r.data),
  remove: (id: string) => apiClient.delete(`/crations/${id}`).then(r => r.data),

  getComments: (crationId: string, limit = 50) =>
    apiClient.get<{ comments: import('./postService').Comment[] }>(`/crations/${crationId}/comments`, { params: { limit } }).then(r => r.data.comments),

  addComment: (crationId: string, text: string) =>
    apiClient.post<import('./postService').Comment>(`/crations/${crationId}/comments`, { text }).then(r => r.data),

  deleteComment: (crationId: string, commentId: string) =>
    apiClient.delete(`/crations/${crationId}/comments/${commentId}`),

  trackShare: (crationId: string) =>
    apiClient.post(`/crations/${crationId}/share`).catch(() => {}),

  getVideoUrl: (path: string) => path.startsWith('http') ? path : `/api/crations/uploads/${path.split('/').pop()}`,
};

export default crationService;
