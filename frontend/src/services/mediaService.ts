import { apiClient, getApiToken } from './api';

export type MediaType = 'IMAGE' | 'VIDEO';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface MediaItem {
  id:               string;
  userId:           string;
  mediaType:        MediaType;
  url:              string;
  thumbnailUrl:     string | null;
  originalUrl:      string;
  width:            number | null;
  height:           number | null;
  aspectRatio:      number | null;
  duration:         number | null;
  mimeType:         string;
  fileSize:         number;
  processingStatus: ProcessingStatus;
  createdAt:        string;
}

export interface PresignedConfig {
  mediaId:       string;
  key:           string;
  uploadUrl:     string;
  uploadMethod:  'PUT' | 'POST';
  uploadHeaders: Record<string, string>;
  isLocal:       boolean;
  expiresAt:     string;
}

export interface PresignedResult {
  media:  MediaItem;
  config: PresignedConfig;
}

export interface UploadProgress {
  loaded:  number;
  total:   number;
  percent: number;
}

export async function requestPresignedUrl(
  file: File,
): Promise<PresignedResult> {
  const { data } = await apiClient.post<PresignedResult>('/media/presigned-url', {
    mimeType: file.type,
    fileSize: file.size,
    fileName: file.name,
  });
  return data;
}

export async function uploadToPresignedUrl(
  config: PresignedConfig,
  file:   File,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress({ loaded: e.loaded, total: e.total, percent: Math.round((e.loaded / e.total) * 100) });
        }
      };
    }

    xhr.onload  = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Upload network error'));

    if (config.isLocal) {
      // Local dev: uploadUrl is relative to the service (e.g. /media/local-upload/:key).
      // Prefix /api so it routes through the API gateway → post-service.
      const url = config.uploadUrl.startsWith('/api') ? config.uploadUrl : `/api${config.uploadUrl}`;
      xhr.open('PUT', url);
      const token = getApiToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    } else {
      // Direct S3 upload
      xhr.open(config.uploadMethod, config.uploadUrl);
      Object.entries(config.uploadHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.send(file);
    }
  });
}

export async function completeUpload(mediaId: string): Promise<MediaItem> {
  const { data } = await apiClient.post<MediaItem>('/media/complete-upload', { mediaId });
  return data;
}

export async function uploadFile(
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<MediaItem> {
  const { media, config } = await requestPresignedUrl(file);
  await uploadToPresignedUrl(config, file, onProgress);
  return completeUpload(media.id);
}

export async function getMedia(id: string): Promise<MediaItem> {
  const { data } = await apiClient.get<MediaItem>(`/media/${id}`);
  return data;
}

export async function deleteMedia(id: string): Promise<void> {
  await apiClient.delete(`/media/${id}`);
}

export function isVideo(m: MediaItem): boolean {
  return m.mediaType === 'VIDEO';
}

export function isReel(m: MediaItem): boolean {
  return m.mediaType === 'VIDEO' || (m.aspectRatio != null && m.aspectRatio <= 0.65);
}
