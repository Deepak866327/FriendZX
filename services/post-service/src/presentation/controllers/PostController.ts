import { Request, Response } from 'express';
import http from 'http';
import { CreatePostUseCase } from '../../application/usecases/CreatePostUseCase';
import { GetFeedUseCase } from '../../application/usecases/GetPublicFeedUseCase';
import { DeletePostUseCase } from '../../application/usecases/DeletePostUseCase';
import { LikePostUseCase } from '../../application/usecases/LikePostUseCase';
import { S3StorageAdapter } from '../../infrastructure/adapters/storage/S3StorageAdapter';

export class PostController {
  constructor(
    private readonly create:    CreatePostUseCase,
    private readonly feed:      GetFeedUseCase,
    private readonly delPost:   DeletePostUseCase,
    private readonly likes:     LikePostUseCase,
    private readonly storage:   S3StorageAdapter,
    private readonly userSvcUrl: string,
    private readonly postRepo:  any,
  ) {}

  createPost = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const { caption, visibility, latitude, longitude, mediaIds } = req.body;
      const post = await this.create.execute({
        userId,
        caption,
        visibility: visibility || 'PUBLIC',
        latitude:  latitude  != null ? parseFloat(latitude)  : undefined,
        longitude: longitude != null ? parseFloat(longitude) : undefined,
        mediaIds:  Array.isArray(mediaIds) ? mediaIds : JSON.parse(mediaIds || '[]'),
      });
      res.status(201).json(this.formatPost(post));
    } catch (err: any) {
      res.status(err.status || 400).json({ error: err.message });
    }
  };

  getPost = async (req: Request, res: Response) => {
    try {
      const post = await this.postRepo.findById(req.params.id);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      res.json(this.formatPost(post));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  publicFeed = async (req: Request, res: Response) => {
    try {
      const result = await this.feed.public(this.parseCursor(req));
      res.json(this.formatFeed(result));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  reelsFeed = async (req: Request, res: Response) => {
    try {
      const result = await this.feed.reels(this.parseCursor(req));
      res.json(this.formatFeed(result));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  friendsFeed = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const following = await this.getFollowing(userId);
      const result = await this.feed.friends([userId, ...following], this.parseCursor(req));
      res.json(this.formatFeed(result));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  nearbyFeed = async (req: Request, res: Response) => {
    try {
      const { latitude, longitude, radius = '50' } = req.query;
      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'latitude and longitude required' });
      }
      const result = await this.feed.nearby(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        parseFloat(radius as string),
        this.parseCursor(req),
      );
      res.json(this.formatFeed(result));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  userPosts = async (req: Request, res: Response) => {
    try {
      const result = await this.feed.user(req.params.userId, this.parseCursor(req));
      res.json(this.formatFeed(result));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  deletePost = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      await this.delPost.execute(req.params.id, userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(err.status || 400).json({ error: err.message });
    }
  };

  likePost = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const post = await this.likes.like(req.params.id, userId);
      res.json(this.formatPost(post));
    } catch (err: any) {
      res.status(err.status || 400).json({ error: err.message });
    }
  };

  unlikePost = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const post = await this.likes.unlike(req.params.id, userId);
      res.json(this.formatPost(post));
    } catch (err: any) {
      res.status(err.status || 400).json({ error: err.message });
    }
  };

  private parseCursor(req: Request) {
    return {
      cursor: req.query.cursor as string | undefined,
      limit:  Math.min(parseInt(req.query.limit as string) || 20, 50),
    };
  }

  private formatPost(post: any) {
    return {
      ...post,
      postMedia: post.postMedia?.map((pm: any) => ({
        order: pm.order,
        media: {
          ...pm.media,
          url:          this.storage.getPublicUrl(pm.media.optimizedUrl || pm.media.originalUrl),
          thumbnailUrl: pm.media.thumbnailUrl ? this.storage.getPublicUrl(pm.media.thumbnailUrl) : null,
        },
      })),
    };
  }

  private formatFeed(result: any) {
    return {
      posts:      result.posts.map((p: any) => this.formatPost(p)),
      nextCursor: result.nextCursor,
      hasMore:    result.hasMore,
    };
  }

  private async getFollowing(userId: string): Promise<string[]> {
    return new Promise(resolve => {
      http.get(`${this.userSvcUrl}/following/${userId}`, r => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => {
          try { resolve(JSON.parse(data)?.following?.map((u: any) => u.userId || u) || []); }
          catch { resolve([]); }
        });
      }).on('error', () => resolve([]));
    });
  }
}
