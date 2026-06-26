import { PrismaPostRepository } from '../../infrastructure/adapters/database/PrismaPostRepository';
import { PrismaMediaRepository } from '../../infrastructure/adapters/database/PrismaMediaRepository';
import { S3StorageAdapter } from '../../infrastructure/adapters/storage/S3StorageAdapter';

export class DeletePostUseCase {
  constructor(
    private readonly postRepo:  PrismaPostRepository,
    private readonly mediaRepo: PrismaMediaRepository,
    private readonly storage:   S3StorageAdapter,
  ) {}

  async execute(postId: string, userId: string): Promise<void> {
    const post = await this.postRepo.findById(postId);
    if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
    if (post.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

    // Delete associated media from storage
    await Promise.allSettled(
      post.postMedia.map(async pm => {
        const m = pm.media as any;
        await Promise.allSettled([
          m.originalUrl  ? this.storage.delete(m.originalUrl)  : Promise.resolve(),
          m.optimizedUrl ? this.storage.delete(m.optimizedUrl) : Promise.resolve(),
          m.thumbnailUrl ? this.storage.delete(m.thumbnailUrl) : Promise.resolve(),
        ]);
        await this.mediaRepo.delete(m.id);
      })
    );

    await this.postRepo.delete(postId, userId);
  }
}
