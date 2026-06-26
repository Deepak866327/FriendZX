import { apiClient } from './api';

export interface VideoRoom {
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  latitude: number;
  longitude: number;
  radius: number;
  participants: string[];
  participantNames: Record<string, string>;
  createdAt: string;
}

const videoRoomService = {
  create: (payload: {
    latitude: number;
    longitude: number;
    radius?: number;
    title?: string;
    creatorName?: string;
  }) => apiClient.post<VideoRoom>('/random-connect/rooms', payload).then(r => r.data),

  getNearby: (latitude: number, longitude: number, radius = 50) =>
    apiClient
      .get<VideoRoom[]>(`/random-connect/rooms/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`)
      .then(r => r.data),

  join: (roomId: string, displayName: string) =>
    apiClient.post<VideoRoom>(`/random-connect/rooms/${roomId}/join`, { displayName }).then(r => r.data),

  leave: (roomId: string) =>
    apiClient.post(`/random-connect/rooms/${roomId}/leave`).then(r => r.data),

  close: (roomId: string) =>
    apiClient.delete(`/random-connect/rooms/${roomId}`).then(r => r.data),
};

export default videoRoomService;
