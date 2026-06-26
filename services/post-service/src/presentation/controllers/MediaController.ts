import { Request, Response } from 'express';
import { CreatePresignedUrlUseCase } from '../../application/usecases/CreatePresignedUrlUseCase';
import { CompleteUploadUseCase } from '../../application/usecases/CompleteUploadUseCase';
import { PrismaMediaRepository } from '../../infrastructure/adapters/database/PrismaMediaRepository';
import { S3StorageAdapter } from '../../infrastructure/adapters/storage/S3StorageAdapter';

export class MediaController {
  constructor(
    private readonly createUrl:    CreatePresignedUrlUseCase,
    private readonly complete:     CompleteUploadUseCase,
    private readonly mediaRepo:    PrismaMediaRepository,
    private readonly storage:      S3StorageAdapter,
  ) {}

  presignedUrl = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const { mimeType, fileSize, fileName } = req.body;

      if (!mimeType || !fileSize) {
        return res.status(400).json({ error: 'mimeType and fileSize are required' });
      }

      const result = await this.createUrl.execute({
        userId,
        mimeType,
        fileSize: parseInt(fileSize),
        fileName: fileName || 'upload',
      });

      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };

  completeUpload = async (req: Request, res: Response) => {
    try {
      const userId  = (req as any).userId as string;
      const { mediaId } = req.body;

      if (!mediaId) return res.status(400).json({ error: 'mediaId is required' });

      const media = await this.complete.execute(mediaId, userId);
      res.json(media);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };

  // Local-dev upload endpoint: PUT /media/local-upload/:encodedKey
  localUpload = async (req: Request, res: Response) => {
    try {
      if (!this.storage.isLocalMode()) {
        return res.status(404).json({ error: 'Local upload is only available in development mode' });
      }
      // Wildcard route: params[0] holds everything after /local-upload/
      const raw  = (req.params as any)[0] as string || '';
      const key  = decodeURIComponent(raw);
      const data = req.body as Buffer;
      if (!Buffer.isBuffer(data) || !data.length) {
        return res.status(400).json({ error: 'Empty body' });
      }
      await this.storage.saveLocalUpload(key, data);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  getMedia = async (req: Request, res: Response) => {
    try {
      const media = await this.mediaRepo.findById(req.params.id);
      if (!media) return res.status(404).json({ error: 'Media not found' });
      res.json(this.formatMedia(media));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  deleteMedia = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const media  = await this.mediaRepo.findById(req.params.id);
      if (!media) return res.status(404).json({ error: 'Media not found' });
      if (media.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      await Promise.allSettled([
        media.originalUrl  ? this.storage.delete(media.originalUrl)  : null,
        media.optimizedUrl ? this.storage.delete(media.optimizedUrl) : null,
        media.thumbnailUrl ? this.storage.delete(media.thumbnailUrl) : null,
      ]);
      await this.mediaRepo.delete(req.params.id);

      res.json({ ok: true });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };

  private formatMedia(m: any) {
    return {
      id:              m.id,
      userId:          m.userId,
      mediaType:       m.mediaType,
      url:             this.storage.getPublicUrl(m.optimizedUrl || m.originalUrl),
      thumbnailUrl:    m.thumbnailUrl ? this.storage.getPublicUrl(m.thumbnailUrl) : null,
      originalUrl:     this.storage.getPublicUrl(m.originalUrl),
      width:           m.width,
      height:          m.height,
      aspectRatio:     m.aspectRatio,
      duration:        m.duration,
      mimeType:        m.mimeType,
      fileSize:        m.fileSize,
      processingStatus: m.processingStatus,
      createdAt:       m.createdAt,
    };
  }
}
