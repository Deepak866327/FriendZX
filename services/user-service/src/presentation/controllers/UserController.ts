import { Request, Response } from 'express';
import { GetProfileUseCase } from '../../application/usecases/GetProfileUseCase';
import { UpdateProfileUseCase } from '../../application/usecases/UpdateProfileUseCase';
import { GetActivityUseCase } from '../../application/usecases/GetActivityUseCase';
import { FollowUserUseCase } from '../../application/usecases/FollowUserUseCase';
import { UnfollowUserUseCase } from '../../application/usecases/UnfollowUserUseCase';
import { GetFollowersUseCase } from '../../application/usecases/GetFollowersUseCase';
import { GetFollowingUseCase } from '../../application/usecases/GetFollowingUseCase';
import { SearchUsersUseCase } from '../../application/usecases/SearchUsersUseCase';
import { Logger } from '../../../../../shared/utils/logger';
import { UpdateProfileDTO } from '../../application/dto/UserDTO';

const logger = new Logger('UserController');

export class UserController {
  constructor(
    private getProfileUseCase: GetProfileUseCase,
    private updateProfileUseCase: UpdateProfileUseCase,
    private getActivityUseCase: GetActivityUseCase,
    private followUserUseCase: FollowUserUseCase,
    private unfollowUserUseCase: UnfollowUserUseCase,
    private getFollowersUseCase: GetFollowersUseCase,
    private getFollowingUseCase: GetFollowingUseCase,
    private searchUsersUseCase: SearchUsersUseCase
  ) {}

  async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const profile = await this.getProfileUseCase.execute(userId);
      res.json(profile);
    } catch (error) {
      logger.error(`Get profile error: ${(error as Error).message}`);
      res.status(404).json({ error: (error as Error).message });
    }
  }

  async getPublicProfile(req: Request, res: Response) {
    try {
      const targetUserId = req.params.userId;
      const profile = await this.getProfileUseCase.execute(targetUserId);
      res.json({
        userId: profile.userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        username: (profile as any).username,
        bio: profile.bio,
        location: profile.location,
        interests: profile.interests,
        photos: profile.photos,
        followers: profile.followers,
        following: profile.following,
        friends: (profile as any).friends ?? 0,
      });
    } catch (error) {
      logger.error(`Get public profile error: ${(error as Error).message}`);
      res.status(404).json({ error: 'Profile not found' });
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const updateData: UpdateProfileDTO = req.body;

      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No data to update' });
      }

      const profile = await this.updateProfileUseCase.execute(userId, updateData);
      res.json(profile);
    } catch (error) {
      logger.error(`Update profile error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getActivity(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const activities = await this.getActivityUseCase.execute(userId, limit, offset);
      res.json({ activities, limit, offset });
    } catch (error) {
      logger.error(`Get activity error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async followUser(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      const followerId = (req as any).userId;

      const result = await this.followUserUseCase.execute(userId, followerId);
      res.json(result);
    } catch (error) {
      logger.error(`Follow user error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async unfollowUser(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      const followerId = (req as any).userId;

      const result = await this.unfollowUserUseCase.execute(userId, followerId);
      res.json(result);
    } catch (error) {
      logger.error(`Unfollow user error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async removeFollower(req: Request, res: Response) {
    try {
      const currentUserId = (req as any).userId;
      const followerIdToRemove = req.params.followerId;

      // Remove followerIdToRemove from currentUserId's followers
      // unfollow(userId, followerId) = "followerId no longer follows userId"
      const result = await this.unfollowUserUseCase.execute(currentUserId, followerIdToRemove);
      res.json({ ...result, message: 'Follower removed successfully' });
    } catch (error) {
      logger.error(`Remove follower error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async uploadPhoto(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const file = (req as any).file as Express.Multer.File;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const mimeType = file.mimetype || 'image/jpeg';
      const b64 = file.buffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${b64}`;

      const profile = await this.getProfileUseCase.execute(userId);
      const existingPhotos: string[] = (profile as any).photos || [];
      // Keep max 1 photo (profile pic)
      const updatedPhotos = [dataUrl];

      const updated = await this.updateProfileUseCase.execute(userId, { photos: updatedPhotos });
      res.json({ url: dataUrl, profile: updated });
    } catch (error) {
      logger.error(`Upload photo error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getFollowers(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const list = await this.getFollowersUseCase.execute(userId, limit, offset);
      res.json({ followers: list });
    } catch (error) {
      logger.error(`Get followers error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getFollowing(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const list = await this.getFollowingUseCase.execute(userId, limit, offset);
      res.json({ following: list });
    } catch (error) {
      logger.error(`Get following error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async searchUsers(req: Request, res: Response) {
    try {
      const query = req.query.q as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      if (!query || query.trim().length < 2) {
        return res.json([]);
      }

      const results = await this.searchUsersUseCase.execute(query, limit);
      res.json(results);
    } catch (error) {
      logger.error(`Search users error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async discoverUsers(req: Request, res: Response) {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
      const results = await this.searchUsersUseCase.discover(limit);
      res.json(results);
    } catch (error) {
      logger.error(`Discover users error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async searchByInterests(req: Request, res: Response) {
    try {
      const interests = (req.query.interests as string)?.split(',') || [];
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      if (interests.length === 0) {
        return res.status(400).json({ error: 'Interests query parameter required' });
      }

      // This would require repository method
      res.json({ message: 'Search by interests not yet implemented' });
    } catch (error) {
      logger.error(`Search error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }
}