import { PrismaPostRepository } from '../../infrastructure/adapters/database/PrismaPostRepository';

export class LikePostUseCase {
  constructor(private readonly postRepo: PrismaPostRepository) {}

  async like(postId: string, userId: string) {
    const post = await this.postRepo.likePost(postId, userId);
    if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
    return post;
  }

  async unlike(postId: string, userId: string) {
    const post = await this.postRepo.unlikePost(postId, userId);
    if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
    return post;
  }
}
