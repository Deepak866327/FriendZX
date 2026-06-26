import { PrismaClient, Post, Visibility } from '@prisma/client';

export interface PostWithMedia extends Post {
  postMedia: Array<{
    order: number;
    media: {
      id:              string;
      mediaType:       string;
      optimizedUrl:    string | null;
      thumbnailUrl:    string | null;
      originalUrl:     string;
      width:           number | null;
      height:          number | null;
      aspectRatio:     number | null;
      duration:        number | null;
      processingStatus: string;
    };
  }>;
}

export interface CreatePostInput {
  userId:     string;
  caption?:   string;
  visibility: Visibility;
  latitude?:  number;
  longitude?: number;
  mediaIds:   string[];
}

export interface FeedCursor {
  cursor?: string;  // base64-encoded ISO date
  limit:   number;
}

export interface FeedResult {
  posts:      PostWithMedia[];
  nextCursor: string | null;
  hasMore:    boolean;
}

const MEDIA_SELECT = {
  order: true,
  media: {
    select: {
      id:              true,
      mediaType:       true,
      optimizedUrl:    true,
      thumbnailUrl:    true,
      originalUrl:     true,
      width:           true,
      height:          true,
      aspectRatio:     true,
      duration:        true,
      processingStatus: true,
    },
  },
};

export class PrismaPostRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreatePostInput): Promise<PostWithMedia> {
    const post = await this.prisma.post.create({
      data: {
        userId:     data.userId,
        caption:    data.caption,
        visibility: data.visibility,
        latitude:   data.latitude,
        longitude:  data.longitude,
        postMedia: {
          create: data.mediaIds.map((mediaId, index) => ({ mediaId, order: index })),
        },
      },
      include: { postMedia: { orderBy: { order: 'asc' }, select: MEDIA_SELECT } },
    });
    return post as unknown as PostWithMedia;
  }

  async findById(id: string): Promise<PostWithMedia | null> {
    const post = await this.prisma.post.findUnique({
      where:   { id },
      include: { postMedia: { orderBy: { order: 'asc' }, select: MEDIA_SELECT } },
    });
    return post as unknown as PostWithMedia | null;
  }

  async getPublicFeed(params: FeedCursor): Promise<FeedResult> {
    return this.getFeed({ visibility: 'PUBLIC' }, params);
  }

  async getFriendsFeed(userIds: string[], params: FeedCursor): Promise<FeedResult> {
    return this.getFeed(
      { userId: { in: userIds }, visibility: { in: ['PUBLIC', 'FRIENDS'] } },
      params,
    );
  }

  async getNearbyFeed(lat: number, lng: number, radiusKm: number, params: FeedCursor): Promise<FeedResult> {
    // PostgreSQL Earth-distance approximation via bounding box
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));

    return this.getFeed(
      {
        visibility: { in: ['PUBLIC', 'NEARBY'] },
        latitude:   { gte: lat - latDelta, lte: lat + latDelta },
        longitude:  { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      params,
    );
  }

  async getReelsFeed(params: FeedCursor): Promise<FeedResult> {
    // Reels = public posts whose first media has ~9:16 aspect ratio (0.45 – 0.65)
    const result = await this.getFeed({ visibility: 'PUBLIC' }, { ...params, limit: params.limit * 3 });
    const reels  = result.posts.filter(p => {
      const first = p.postMedia[0]?.media;
      return first?.mediaType === 'VIDEO' || (first?.aspectRatio != null && first.aspectRatio <= 0.65);
    }).slice(0, params.limit);

    return {
      posts:      reels,
      nextCursor: result.nextCursor,
      hasMore:    result.hasMore,
    };
  }

  async getUserPosts(userId: string, params: FeedCursor): Promise<FeedResult> {
    return this.getFeed({ userId }, params);
  }

  async likePost(postId: string, userId: string): Promise<PostWithMedia | null> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) return null;
    if (post.likes.includes(userId)) return this.findById(postId);

    const updated = await this.prisma.post.update({
      where:   { id: postId },
      data:    { likes: { push: userId }, likesCount: { increment: 1 } },
      include: { postMedia: { orderBy: { order: 'asc' }, select: MEDIA_SELECT } },
    });
    return updated as unknown as PostWithMedia;
  }

  async unlikePost(postId: string, userId: string): Promise<PostWithMedia | null> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) return null;
    if (!post.likes.includes(userId)) return this.findById(postId);

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data:  {
        likes:      post.likes.filter(id => id !== userId),
        likesCount: { decrement: 1 },
      },
      include: { postMedia: { orderBy: { order: 'asc' }, select: MEDIA_SELECT } },
    });
    return updated as unknown as PostWithMedia;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post || post.userId !== userId) return false;
    await this.prisma.post.delete({ where: { id } });
    return true;
  }

  private async getFeed(where: object, params: FeedCursor): Promise<FeedResult> {
    const limit = Math.min(params.limit, 50);
    const cursor = params.cursor ? new Date(Buffer.from(params.cursor, 'base64').toString()) : undefined;

    const posts = await this.prisma.post.findMany({
      where:   cursor ? { ...where, createdAt: { lt: cursor } } : where,
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      include: { postMedia: { orderBy: { order: 'asc' }, select: MEDIA_SELECT } },
    });

    const hasMore    = posts.length > limit;
    const items      = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore
      ? Buffer.from(items[items.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    return { posts: items as unknown as PostWithMedia[], nextCursor, hasMore };
  }
}
