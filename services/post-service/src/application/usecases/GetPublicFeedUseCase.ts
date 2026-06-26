import { PrismaPostRepository, FeedCursor } from '../../infrastructure/adapters/database/PrismaPostRepository';

export class GetFeedUseCase {
  readonly repo: PrismaPostRepository;
  constructor(postRepo: PrismaPostRepository) { this.repo = postRepo; }

  public(params: FeedCursor) {
    return this.repo.getPublicFeed(params);
  }

  reels(params: FeedCursor) {
    return this.repo.getReelsFeed(params);
  }

  user(userId: string, params: FeedCursor) {
    return this.repo.getUserPosts(userId, params);
  }

  friends(userIds: string[], params: FeedCursor) {
    return this.repo.getFriendsFeed(userIds, params);
  }

  nearby(lat: number, lng: number, radiusKm: number, params: FeedCursor) {
    return this.repo.getNearbyFeed(lat, lng, radiusKm, params);
  }
}
