import { apiClient } from './api';
import { Post, FeedPage } from './postService';

export interface Community {
  id:           string;
  name:         string;
  description:  string;
  coverImage?:  string;
  mode:         'private' | 'public';
  visibility?:  'public' | 'nearby';
  nearbyRadius?: number;
  location?:    any;
  adminId:      string;
  members:      string[];
  memberCount:  number;
  createdAt:    string;
  updatedAt:    string;
}

export interface CreateCommunityPayload {
  name:          string;
  description?:  string;
  coverImage?:   File;
  mode:          'private' | 'public';
  visibility?:   'public' | 'nearby';
  nearbyRadius?: number;
  latitude?:     number;
  longitude?:    number;
}

const communityService = {
  create(payload: CreateCommunityPayload) {
    const form = new FormData();
    form.append('name', payload.name);
    if (payload.description)   form.append('description',  payload.description);
    form.append('mode', payload.mode);
    if (payload.visibility)    form.append('visibility',   payload.visibility);
    if (payload.nearbyRadius != null) form.append('nearbyRadius', String(payload.nearbyRadius));
    if (payload.latitude  != null)   form.append('latitude',  String(payload.latitude));
    if (payload.longitude != null)   form.append('longitude', String(payload.longitude));
    if (payload.coverImage)    form.append('coverImage', payload.coverImage);
    return apiClient.post<Community>('/communities', form, { headers: { 'Content-Type': undefined } })
      .then(r => r.data);
  },

  getMine: () =>
    apiClient.get<Community[]>('/communities/mine').then(r => r.data),

  discover(latitude?: number, longitude?: number) {
    const qs = latitude != null && longitude != null
      ? `?latitude=${latitude}&longitude=${longitude}`
      : '';
    return apiClient.get<Community[]>(`/communities/discover${qs}`).then(r => r.data);
  },

  getOne: (id: string) =>
    apiClient.get<Community>(`/communities/${id}`).then(r => r.data),

  update(id: string, payload: Partial<CreateCommunityPayload>) {
    const form = new FormData();
    if (payload.name)              form.append('name',        payload.name);
    if (payload.description !== undefined) form.append('description', payload.description || '');
    if (payload.visibility)        form.append('visibility',  payload.visibility);
    if (payload.nearbyRadius != null) form.append('nearbyRadius', String(payload.nearbyRadius));
    if (payload.latitude  != null) form.append('latitude',  String(payload.latitude));
    if (payload.longitude != null) form.append('longitude', String(payload.longitude));
    if (payload.coverImage)        form.append('coverImage', payload.coverImage);
    return apiClient.put<Community>(`/communities/${id}`, form, { headers: { 'Content-Type': undefined } })
      .then(r => r.data);
  },

  delete: (id: string) =>
    apiClient.delete(`/communities/${id}`).then(r => r.data),

  join:  (id: string) => apiClient.post(`/communities/${id}/join`).then(r => r.data),
  leave: (id: string) => apiClient.post(`/communities/${id}/leave`).then(r => r.data),

  addMember: (communityId: string, targetUserId: string) =>
    apiClient.post(`/communities/${communityId}/members`, { targetUserId }).then(r => r.data),

  removeMember: (communityId: string, targetUserId: string) =>
    apiClient.delete(`/communities/${communityId}/members/${targetUserId}`).then(r => r.data),

  getFeed: (id: string, page = 1, limit = 20) =>
    apiClient.get<FeedPage>(`/communities/${id}/feed?page=${page}&limit=${limit}`).then(r => r.data),

  getMyFeed: (page = 1, limit = 20) =>
    apiClient.get<FeedPage>(`/communities/feed?page=${page}&limit=${limit}`).then(r => r.data),

  createPost(communityId: string, payload: { content: string; images?: File[] }) {
    const form = new FormData();
    form.append('content', payload.content);
    (payload.images || []).forEach(f => form.append('images', f));
    return apiClient.post<Post>(`/communities/${communityId}/posts`, form, {
      headers: { 'Content-Type': undefined },
    }).then(r => r.data);
  },
};

export default communityService;
