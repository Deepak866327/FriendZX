import { S3StorageAdapter } from '../../infrastructure/adapters/storage/S3StorageAdapter';
import { PrismaMediaRepository } from '../../infrastructure/adapters/database/PrismaMediaRepository';
import { MediaEventProducer } from '../../infrastructure/kafka/MediaEventProducer';
import { processImage } from '../../infrastructure/adapters/processing/SharpImageProcessor';
import { processVideo } from '../../infrastructure/adapters/processing/FfmpegVideoProcessor';
import { Logger } from '../../../../../shared/utils/logger';
import { randomUUID } from 'crypto';
import path from 'path';

const logger = new Logger('CompleteUploadUseCase');

export class CompleteUploadUseCase {
  constructor(
    private readonly storage:    S3StorageAdapter,
    private readonly mediaRepo:  PrismaMediaRepository,
    private readonly events:     MediaEventProducer,
  ) {}

  async execute(mediaId: string, userId: string) {
    const media = await this.mediaRepo.findById(mediaId);
    if (!media)                  throw Object.assign(new Error('Media not found'), { status: 404 });
    if (media.userId !== userId) throw Object.assign(new Error('Forbidden'),       { status: 403 });

    const uploaded = await this.storage.exists(media.originalUrl);
    if (!uploaded) throw Object.assign(new Error('File not yet uploaded to storage'), { status: 400 });

    await this.mediaRepo.update(mediaId, { processingStatus: 'PROCESSING' });
    await this.events.emit('MEDIA_PROCESSING_STARTED', { mediaId, userId });

    // Run async — don't block the response
    this.processAsync(media as any).catch(err =>
      logger.error(`Processing failed for ${mediaId}: ${err.message}`)
    );

    return this.mediaRepo.findById(mediaId);
  }

  private async processAsync(media: { id: string; userId: string; originalUrl: string; mimeType: string; mediaType: string }) {
    try {
      const inputBuffer = await this.storage.getBuffer(media.originalUrl);
      const userId      = media.userId;
      const base        = path.basename(media.originalUrl, path.extname(media.originalUrl));

      if (media.mediaType === 'IMAGE') {
        await this.processImage(media.id, userId, base, inputBuffer, media.mimeType);
      } else {
        await this.processVideo(media.id, userId, base, inputBuffer, media.mimeType);
      }

      await this.events.emit('MEDIA_PROCESSING_COMPLETED', { mediaId: media.id, userId });
    } catch (err: any) {
      logger.error(`Processing error: ${err.message}`);
      await this.mediaRepo.update(media.id, { processingStatus: 'FAILED' });
      await this.events.emit('MEDIA_PROCESSING_FAILED', { mediaId: media.id, error: err.message });
    }
  }

  private async processImage(
    mediaId: string,
    userId:  string,
    base:    string,
    input:   Buffer,
    mimeType: string,
  ) {
    const result = await processImage(input);

    const [thumbKey, fullKey] = await Promise.all([
      this.storage.uploadBuffer(
        result.thumbnail,
        `users/${userId}/thumbnails/${base}_thumb.jpg`,
        'image/jpeg',
      ).then(() => `users/${userId}/thumbnails/${base}_thumb.jpg`),
      this.storage.uploadBuffer(
        result.full,
        `users/${userId}/images/${base}_full.jpg`,
        'image/jpeg',
      ).then(() => `users/${userId}/images/${base}_full.jpg`),
    ]);

    await this.mediaRepo.update(mediaId, {
      optimizedUrl:    fullKey,
      thumbnailUrl:    thumbKey,
      width:           result.meta.width,
      height:          result.meta.height,
      aspectRatio:     result.meta.aspectRatio,
      processingStatus: 'COMPLETED',
    });
  }

  private async processVideo(
    mediaId:  string,
    userId:   string,
    base:     string,
    input:    Buffer,
    mimeType: string,
  ) {
    const result = await processVideo(input, mimeType);

    const thumbKey = `users/${userId}/thumbnails/${base}_thumb.jpg`;
    const p720Key  = `users/${userId}/videos/${base}_720p.mp4`;

    await Promise.all([
      this.storage.uploadBuffer(result.thumbnail, thumbKey, 'image/jpeg'),
      this.storage.uploadBuffer(result.p720, p720Key, 'video/mp4'),
      result.p1080 ? this.storage.uploadBuffer(
        result.p1080, `users/${userId}/videos/${base}_1080p.mp4`, 'video/mp4'
      ) : Promise.resolve(),
    ]);

    await this.mediaRepo.update(mediaId, {
      optimizedUrl:    p720Key,
      thumbnailUrl:    thumbKey,
      width:           result.meta.width,
      height:          result.meta.height,
      aspectRatio:     result.meta.aspectRatio,
      duration:        result.meta.duration,
      processingStatus: 'COMPLETED',
    });
  }
}
