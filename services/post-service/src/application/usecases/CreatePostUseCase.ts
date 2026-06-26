import { Visibility } from '@prisma/client';
import { PrismaPostRepository } from '../../infrastructure/adapters/database/PrismaPostRepository';
import { PrismaMediaRepository } from '../../infrastructure/adapters/database/PrismaMediaRepository';
import { MediaEventProducer } from '../../infrastructure/kafka/MediaEventProducer';

export interface CreatePostInput {
  userId:     string;
  caption?:   string;
  visibility: string;
  latitude?:  number;
  longitude?: number;
  mediaIds?:  string[];
}

export class CreatePostUseCase {
  constructor(
    private readonly postRepo:  PrismaPostRepository,
    private readonly mediaRepo: PrismaMediaRepository,
    private readonly events:    MediaEventProducer,
  ) {}

  async execute(input: CreatePostInput) {
    const { userId, caption, visibility, latitude, longitude, mediaIds = [] } = input;

    if (!caption?.trim() && !mediaIds.length) {
      throw Object.assign(new Error('Post must have text or at least one image'), { status: 422 });
    }
    if (mediaIds.length > 10) {
      throw Object.assign(new Error('Maximum 10 images per post'), { status: 422 });
    }

    const vis = ['PUBLIC', 'FRIENDS', 'NEARBY', 'PRIVATE'].includes(visibility?.toUpperCase())
      ? (visibility.toUpperCase() as Visibility)
      : 'PUBLIC';

    if (mediaIds.length) {
      const mediaList = await Promise.all(mediaIds.map(id => this.mediaRepo.findById(id)));
      for (const [i, m] of mediaList.entries()) {
        if (!m)                  throw Object.assign(new Error(`Media ${mediaIds[i]} not found`), { status: 404 });
        if (m.userId !== userId) throw Object.assign(new Error('Forbidden'),                      { status: 403 });
      }
    }

    const post = await this.postRepo.create({ userId, caption, visibility: vis, latitude, longitude, mediaIds });

    await this.events.emit('POST_CREATED', { postId: post.id, userId, visibility: vis });

    return post;
  }
}
