import { randomUUID } from 'crypto';
import { S3StorageAdapter } from '../../infrastructure/adapters/storage/S3StorageAdapter';
import { PrismaMediaRepository } from '../../infrastructure/adapters/database/PrismaMediaRepository';
import { MediaEventProducer } from '../../infrastructure/kafka/MediaEventProducer';

// image/jpg is non-standard but included as a safety alias — browsers always report image/jpeg
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/pjpeg']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/mov', 'video/webm', 'video/quicktime']);
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;   // 20 MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;  // 200 MB

export interface PresignedUrlInput {
  userId:   string;
  mimeType: string;
  fileSize: number;
  fileName: string;
}

export class CreatePresignedUrlUseCase {
  constructor(
    private readonly storage: S3StorageAdapter,
    private readonly mediaRepo: PrismaMediaRepository,
    private readonly events: MediaEventProducer,
  ) {}

  async execute(input: PresignedUrlInput) {
    const { userId, mimeType, fileSize, fileName } = input;

    const isImage = IMAGE_TYPES.has(mimeType.toLowerCase());
    const isVideo = VIDEO_TYPES.has(mimeType.toLowerCase());

    if (!isImage && !isVideo) {
      throw Object.assign(new Error(`Unsupported file type: ${mimeType}`), { status: 422 });
    }
    if (isImage && fileSize > MAX_IMAGE_SIZE) {
      throw Object.assign(new Error('Image exceeds 20 MB limit'), { status: 422 });
    }
    if (isVideo && fileSize > MAX_VIDEO_SIZE) {
      throw Object.assign(new Error('Video exceeds 200 MB limit'), { status: 422 });
    }

    const mediaId    = randomUUID();
    const storageType = isImage ? 'images' : 'videos';
    const key        = this.storage.buildKey(userId, storageType, mimeType);

    const media = await this.mediaRepo.create({
      id:          mediaId,
      userId,
      mediaType:   isImage ? 'IMAGE' : 'VIDEO',
      originalUrl: key,
      mimeType,
      fileSize,
    });

    const config = await this.storage.generatePresignedPutUrl(mediaId, key, mimeType);

    await this.events.emit('MEDIA_UPLOADED', { mediaId, userId, mimeType, fileSize, fileName });

    return { media, config };
  }
}
