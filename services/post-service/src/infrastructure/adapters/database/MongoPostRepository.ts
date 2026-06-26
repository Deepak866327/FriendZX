import { Model } from 'mongoose';
import { IPostRepository, CreatePostInput, FeedPage } from '../../../domain/repositories/IPostRepository';
import { Post } from '../../../domain/entities/Post';
import { Logger } from '../../../../../../shared/utils/logger';

const logger = new Logger('MongoPostRepository');

function toPost(doc: any): Post {
  return {
    id:            doc._id.toString(),
    userId:        doc.userId,
    content:       doc.content,
    mediaUrls:     doc.mediaUrls,
    visibility:    doc.visibility,
    nearbyRadius:  doc.nearbyRadius,
    location:      doc.location,
    communityId:   doc.communityId,
    communityName: doc.communityName,
    likes:         doc.likes,
    likesCount:    doc.likesCount,
    createdAt:     doc.createdAt,
    updatedAt:     doc.updatedAt,
  };
}

export class MongoPostRepository implements IPostRepository {
  constructor(private postModel: Model<any>) {}

  async create(input: CreatePostInput): Promise<Post> {
    const doc = await this.postModel.create({
      userId: input.userId,
      content: input.content,
      mediaUrls: input.mediaUrls,
      visibility: input.visibility,
      nearbyRadius: input.nearbyRadius,
      location: input.location
        ? {
            type: 'Point',
            coordinates: [input.location.longitude, input.location.latitude],
          }
        : undefined,
      likes: [],
      likesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPost(doc);
  }

  async findById(id: string): Promise<Post | null> {
    try {
      const doc = await this.postModel.findById(id);
      return doc ? toPost(doc) : null;
    } catch {
      return null;
    }
  }

  async findUserPosts(
    userId: string,
    viewerId: string,
    isFriend: boolean,
    page: number,
    limit: number
  ): Promise<FeedPage> {
    const skip = (page - 1) * limit;

    // Viewer sees: own posts (all), friend posts (public + private), stranger posts (public only)
    let visibilityFilter: any;
    if (userId === viewerId) {
      visibilityFilter = {};
    } else if (isFriend) {
      visibilityFilter = { visibility: { $in: ['public', 'private', 'nearby'] } };
    } else {
      visibilityFilter = { visibility: 'public' };
    }

    const filter = { userId, ...visibilityFilter };
    const [docs, total] = await Promise.all([
      this.postModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.postModel.countDocuments(filter),
    ]);

    return { posts: docs.map(toPost), total, page, hasMore: skip + docs.length < total };
  }

  async findPublicFeed(page: number, limit: number): Promise<FeedPage> {
    const skip = (page - 1) * limit;
    const filter = { visibility: 'public' };
    const [docs, total] = await Promise.all([
      this.postModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.postModel.countDocuments(filter),
    ]);
    return { posts: docs.map(toPost), total, page, hasMore: skip + docs.length < total };
  }

  async findFriendsFeed(friendIds: string[], page: number, limit: number): Promise<FeedPage> {
    const skip = (page - 1) * limit;
    // Friends can see public and private (but not nearby — that requires location check)
    const filter = {
      userId: { $in: friendIds },
      visibility: { $in: ['public', 'private'] },
    };
    const [docs, total] = await Promise.all([
      this.postModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.postModel.countDocuments(filter),
    ]);
    return { posts: docs.map(toPost), total, page, hasMore: skip + docs.length < total };
  }

  async findNearbyFeed(latitude: number, longitude: number, page: number, limit: number): Promise<FeedPage> {
    const skip = (page - 1) * limit;

    // $geoNear returns distance in meters. Filter: distance (m) <= nearbyRadius (km) * 1000
    const pipeline: any[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [longitude, latitude] },
          distanceField: 'distanceMeters',
          spherical: true,
          query: { visibility: 'nearby' },
          maxDistance: 100 * 1000, // hard cap 100 km
        },
      },
      {
        // Keep only posts where the viewer is within the author's chosen radius
        $match: {
          $expr: { $lte: ['$distanceMeters', { $multiply: ['$nearbyRadius', 1000] }] },
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const countPipeline = [...pipeline, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [docs, countResult] = await Promise.all([
      this.postModel.aggregate(dataPipeline),
      this.postModel.aggregate(countPipeline),
    ]);

    const total = countResult[0]?.total ?? 0;
    return { posts: docs.map(toPost), total, page, hasMore: skip + docs.length < total };
  }

  async like(postId: string, userId: string): Promise<Post | null> {
    try {
      const doc = await this.postModel.findByIdAndUpdate(
        postId,
        { $addToSet: { likes: userId }, $inc: { likesCount: 1 } },
        { new: true }
      );
      return doc ? toPost(doc) : null;
    } catch {
      return null;
    }
  }

  async unlike(postId: string, userId: string): Promise<Post | null> {
    try {
      const doc = await this.postModel.findByIdAndUpdate(
        postId,
        { $pull: { likes: userId }, $inc: { likesCount: -1 } },
        { new: true }
      );
      return doc ? toPost(doc) : null;
    } catch {
      return null;
    }
  }

  async delete(postId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.postModel.deleteOne({ _id: postId, userId });
      return result.deletedCount > 0;
    } catch {
      return false;
    }
  }
}
