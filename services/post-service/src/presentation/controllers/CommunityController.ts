import { Request, Response } from 'express';
import { Model } from 'mongoose';

function toCommunity(doc: any) {
  return {
    id:           doc._id.toString(),
    name:         doc.name,
    description:  doc.description || '',
    coverImage:   doc.coverImage,
    mode:         doc.mode,
    visibility:   doc.visibility,
    nearbyRadius: doc.nearbyRadius,
    location:     doc.location,
    adminId:      doc.adminId,
    members:      doc.members || [],
    memberCount:  doc.memberCount || 0,
    createdAt:    doc.createdAt,
    updatedAt:    doc.updatedAt,
  };
}

function toPost(doc: any) {
  return {
    id:            doc._id.toString(),
    userId:        doc.userId,
    content:       doc.content,
    mediaUrls:     doc.mediaUrls || [],
    visibility:    doc.visibility,
    nearbyRadius:  doc.nearbyRadius,
    location:      doc.location,
    communityId:   doc.communityId,
    communityName: doc.communityName,
    likes:         doc.likes || [],
    likesCount:    doc.likesCount || 0,
    createdAt:     doc.createdAt,
    updatedAt:     doc.updatedAt,
  };
}

export class CommunityController {
  constructor(
    private communityModel: Model<any>,
    private postModel: Model<any>
  ) {}

  create = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const { name, description, mode, visibility, nearbyRadius, latitude, longitude } = req.body;

      if (!name?.trim()) return res.status(400).json({ error: 'Community name is required' });
      if (!['private', 'public'].includes(mode))
        return res.status(400).json({ error: 'Mode must be private or public' });

      const coverFile = (req.file as Express.Multer.File) || null;
      const data: any = {
        name:        name.trim(),
        description: description?.trim() || '',
        mode,
        adminId:     userId,
        members:     [userId],
        memberCount: 1,
        createdAt:   new Date(),
        updatedAt:   new Date(),
      };
      if (coverFile) data.coverImage = `/uploads/${coverFile.filename}`;

      if (mode === 'public') {
        data.visibility = visibility || 'public';
        if (data.visibility === 'nearby') {
          if (!latitude || !longitude)
            return res.status(400).json({ error: 'Location required for nearby visibility' });
          if (!nearbyRadius)
            return res.status(400).json({ error: 'Radius required for nearby visibility' });
          data.nearbyRadius = Number(nearbyRadius);
          data.location = { type: 'Point', coordinates: [Number(longitude), Number(latitude)] };
        }
      }

      const doc = await this.communityModel.create(data);
      res.status(201).json(toCommunity(doc));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  mine = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const docs = await this.communityModel.find({ members: userId }).sort({ updatedAt: -1 });
      res.json(docs.map(toCommunity));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  discover = async (req: Request, res: Response) => {
    try {
      const userId  = (req as any).userId as string;
      const { latitude, longitude } = req.query;

      let docs: any[];

      if (latitude && longitude) {
        const lng = Number(longitude);
        const lat = Number(latitude);
        // $nearSphere cannot be used inside $or — run two queries and merge
        const [publicDocs, nearbyDocs] = await Promise.all([
          this.communityModel.find({
            mode: 'public', visibility: 'public', members: { $ne: userId },
          }).sort({ memberCount: -1 }).limit(20),
          this.communityModel.find({
            mode: 'public', visibility: 'nearby', members: { $ne: userId },
            location: {
              $nearSphere: {
                $geometry: { type: 'Point', coordinates: [lng, lat] },
                $maxDistance: 100 * 1000,
              },
            },
          }).limit(20),
        ]);
        const seen = new Set<string>();
        docs = [];
        for (const d of [...publicDocs, ...nearbyDocs]) {
          const id = d._id.toString();
          if (!seen.has(id)) { seen.add(id); docs.push(d); }
        }
      } else {
        docs = await this.communityModel
          .find({ mode: 'public', visibility: 'public', members: { $ne: userId } })
          .sort({ memberCount: -1 })
          .limit(20);
      }

      res.json(docs.map(toCommunity));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  getOne = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const doc    = await this.communityModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Community not found' });

      if (doc.mode === 'private' && !doc.members.includes(userId) && doc.adminId !== userId)
        return res.status(403).json({ error: 'Access denied' });

      res.json(toCommunity(doc));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const doc    = await this.communityModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Community not found' });
      if (doc.adminId !== userId) return res.status(403).json({ error: 'Not authorized' });

      const { name, description, visibility, nearbyRadius, latitude, longitude } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (name)                 updates.name        = name.trim();
      if (description !== undefined) updates.description = description.trim();

      if (doc.mode === 'public' && visibility) {
        updates.visibility = visibility;
        if (visibility === 'nearby' && latitude && longitude) {
          updates.nearbyRadius = nearbyRadius ? Number(nearbyRadius) : doc.nearbyRadius;
          updates.location     = { type: 'Point', coordinates: [Number(longitude), Number(latitude)] };
        }
      }

      const coverFile = (req.file as Express.Multer.File) || null;
      if (coverFile) updates.coverImage = `/uploads/${coverFile.filename}`;

      const updated = await this.communityModel.findByIdAndUpdate(req.params.id, updates, { new: true });
      res.json(toCommunity(updated));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const doc    = await this.communityModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Community not found' });
      if (doc.adminId !== userId) return res.status(403).json({ error: 'Not authorized' });

      await this.communityModel.deleteOne({ _id: req.params.id });
      await this.postModel.deleteMany({ communityId: req.params.id });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  join = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const doc    = await this.communityModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Community not found' });
      if (doc.mode === 'private')
        return res.status(403).json({ error: 'Private community requires an invitation from admin' });
      if (doc.members.includes(userId))
        return res.status(400).json({ error: 'Already a member' });

      await this.communityModel.findByIdAndUpdate(req.params.id, {
        $addToSet: { members: userId },
        $inc:      { memberCount: 1 },
        updatedAt: new Date(),
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  leave = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const doc    = await this.communityModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Community not found' });
      if (doc.adminId === userId)
        return res.status(400).json({ error: 'Admin cannot leave — delete the community instead' });
      if (!doc.members.includes(userId))
        return res.status(400).json({ error: 'Not a member' });

      await this.communityModel.findByIdAndUpdate(req.params.id, {
        $pull:     { members: userId },
        $inc:      { memberCount: -1 },
        updatedAt: new Date(),
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  addMember = async (req: Request, res: Response) => {
    try {
      const userId       = (req as any).userId as string;
      const { targetUserId } = req.body;
      if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });

      const doc = await this.communityModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Community not found' });
      if (doc.adminId !== userId) return res.status(403).json({ error: 'Only admin can add members' });
      if (doc.members.includes(targetUserId))
        return res.status(400).json({ error: 'User is already a member' });

      await this.communityModel.findByIdAndUpdate(req.params.id, {
        $addToSet: { members: targetUserId },
        $inc:      { memberCount: 1 },
        updatedAt: new Date(),
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  removeMember = async (req: Request, res: Response) => {
    try {
      const userId       = (req as any).userId as string;
      const { targetUserId } = req.params;

      const doc = await this.communityModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Community not found' });
      if (doc.adminId !== userId) return res.status(403).json({ error: 'Only admin can remove members' });
      if (doc.adminId === targetUserId) return res.status(400).json({ error: 'Cannot remove admin' });

      await this.communityModel.findByIdAndUpdate(req.params.id, {
        $pull:     { members: targetUserId },
        $inc:      { memberCount: -1 },
        updatedAt: new Date(),
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  feed = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const doc    = await this.communityModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Community not found' });

      if (doc.mode === 'private' && !doc.members.includes(userId))
        return res.status(403).json({ error: 'Access denied' });

      const page  = parseInt(req.query.page as string)  || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const skip  = (page - 1) * limit;

      const filter = { communityId: req.params.id };
      const [posts, total] = await Promise.all([
        this.postModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        this.postModel.countDocuments(filter),
      ]);

      res.json({ posts: posts.map(toPost), total, page, hasMore: skip + posts.length < total });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  createPost = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const doc    = await this.communityModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Community not found' });
      if (!doc.members.includes(userId))
        return res.status(403).json({ error: 'You must be a member to post' });

      const { content } = req.body;
      const uploadedFiles = (req.files as Express.Multer.File[]) || [];
      const mediaUrls     = uploadedFiles.map((f) => `/uploads/${f.filename}`);

      if (!content?.trim() && mediaUrls.length === 0)
        return res.status(400).json({ error: 'Post must have content or media' });

      const visibility = doc.mode === 'private' ? 'private' : (doc.visibility || 'public');

      const post = await this.postModel.create({
        userId,
        content:       content?.trim() || '',
        mediaUrls,
        visibility,
        communityId:   req.params.id,
        communityName: doc.name,
        likes:         [],
        likesCount:    0,
        createdAt:     new Date(),
        updatedAt:     new Date(),
      });

      res.status(201).json(toPost(post));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  myFeed = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const page   = parseInt(req.query.page as string)  || 1;
      const limit  = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const skip   = (page - 1) * limit;

      const communities  = await this.communityModel.find({ members: userId }, '_id');
      const communityIds = communities.map((c: any) => c._id.toString());

      if (communityIds.length === 0)
        return res.json({ posts: [], total: 0, page, hasMore: false });

      const filter = { communityId: { $in: communityIds } };
      const [posts, total] = await Promise.all([
        this.postModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        this.postModel.countDocuments(filter),
      ]);

      res.json({ posts: posts.map(toPost), total, page, hasMore: skip + posts.length < total });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };
}
