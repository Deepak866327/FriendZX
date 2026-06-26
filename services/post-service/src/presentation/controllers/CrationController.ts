import { Request, Response } from 'express';
import { Model } from 'mongoose';
import http from 'http';

function toCration(doc: any) {
  return {
    id:           doc._id.toString(),
    userId:       doc.userId,
    caption:      doc.caption || '',
    videoUrl:     doc.videoUrl,
    thumbnailUrl: doc.thumbnailUrl || null,
    visibility:   doc.visibility || 'public',
    nearbyRadius: doc.nearbyRadius,
    likes:        doc.likes || [],
    likesCount:   doc.likesCount || 0,
    views:        doc.views || 0,
    createdAt:    doc.createdAt,
  };
}

function paginationParams(req: Request) {
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(20, parseInt(req.query.limit as string) || 10);
  return { page, limit, skip: (page - 1) * limit };
}

function respond(res: Response, docs: any[], total: number, page: number, limit: number, skip: number) {
  res.json({ crations: docs.map(toCration), total, page, hasMore: skip + docs.length < total });
}

async function getFollowing(userServiceUrl: string, userId: string): Promise<string[]> {
  return new Promise((resolve) => {
    const url = `${userServiceUrl}/following/${userId}`;
    http.get(url, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => {
        try { resolve(JSON.parse(data)?.following?.map((u: any) => u.userId || u) || []); }
        catch { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

export class CrationController {
  constructor(
    private readonly CrationModel: Model<any>,
    private readonly userServiceUrl: string = 'http://localhost:3002',
  ) {}

  create = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { caption, visibility, nearbyRadius, latitude, longitude } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const videoFile = files?.['video']?.[0];
      if (!videoFile) return res.status(400).json({ error: 'Video file is required' });

      const videoUrl    = `/crations/uploads/${videoFile.filename}`;
      const thumbFile   = files?.['thumbnail']?.[0];
      const thumbnailUrl = thumbFile ? `/crations/uploads/${thumbFile.filename}` : null;

      const vis = ['public', 'friends', 'nearby'].includes(visibility) ? visibility : 'public';
      const data: any = { userId, caption: caption || '', videoUrl, thumbnailUrl, visibility: vis };

      if (vis === 'nearby' && latitude && longitude) {
        data.nearbyRadius = Number(nearbyRadius) || 10;
        data.location = { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] };
      }

      const doc = await this.CrationModel.create(data);
      res.status(201).json(toCration(doc));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  // Public feed
  publicFeed = async (req: Request, res: Response) => {
    try {
      const { page, limit, skip } = paginationParams(req);
      const query = { visibility: 'public' };
      const [docs, total] = await Promise.all([
        this.CrationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        this.CrationModel.countDocuments(query),
      ]);
      respond(res, docs, total, page, limit, skip);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  };

  // Friends feed — crations from users the caller follows
  friendsFeed = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { page, limit, skip } = paginationParams(req);
      const following = await getFollowing(this.userServiceUrl, userId);
      const userIds = [...following, userId];
      const query = { userId: { $in: userIds }, visibility: { $in: ['public', 'friends'] } };
      const [docs, total] = await Promise.all([
        this.CrationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        this.CrationModel.countDocuments(query),
      ]);
      respond(res, docs, total, page, limit, skip);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  };

  // Nearby feed — geo within radius, visibility=nearby|public
  nearbyFeed = async (req: Request, res: Response) => {
    try {
      const { page, limit, skip } = paginationParams(req);
      const lat = parseFloat(req.query.latitude as string);
      const lng = parseFloat(req.query.longitude as string);
      if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'latitude and longitude required' });
      const radiusKm = parseFloat(req.query.radius as string) || 50;
      const maxDistM = radiusKm * 1000;

      // $near sorts by distance (requires 2dsphere index) — but is NOT allowed in countDocuments.
      // Use $near for the find, and $geoWithin/$centerSphere for the count.
      const visFilter = { visibility: { $in: ['public', 'nearby'] } };
      const nearQuery   = { ...visFilter, location: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: maxDistM } } };
      const withinQuery = { ...visFilter, location: { $geoWithin: { $centerSphere: [[lng, lat], radiusKm / 6371] } } };

      const [docs, total] = await Promise.all([
        this.CrationModel.find(nearQuery).skip(skip).limit(limit).lean(),
        this.CrationModel.countDocuments(withinQuery),
      ]);
      respond(res, docs, total, page, limit, skip);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  };

  // Legacy all-crations feed (used by CrationFeed reels view)
  feed = async (req: Request, res: Response) => {
    try {
      const { page, limit, skip } = paginationParams(req);
      const [docs, total] = await Promise.all([
        this.CrationModel.find({ visibility: 'public' }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        this.CrationModel.countDocuments({ visibility: 'public' }),
      ]);
      respond(res, docs, total, page, limit, skip);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  };

  userCrations = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { page, limit, skip } = paginationParams(req);
      const [docs, total] = await Promise.all([
        this.CrationModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        this.CrationModel.countDocuments({ userId }),
      ]);
      respond(res, docs, total, page, limit, skip);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  };

  like = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const doc = await this.CrationModel.findByIdAndUpdate(
        req.params.id,
        { $addToSet: { likes: userId }, $inc: { likesCount: 1 } },
        { new: true }
      ).lean();
      if (!doc) return res.status(404).json({ error: 'Cration not found' });
      res.json(toCration(doc));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  };

  unlike = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const doc = await this.CrationModel.findByIdAndUpdate(
        req.params.id,
        { $pull: { likes: userId }, $inc: { likesCount: -1 } },
        { new: true }
      ).lean();
      if (!doc) return res.status(404).json({ error: 'Cration not found' });
      res.json(toCration(doc));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  };

  remove = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const doc = await this.CrationModel.findOneAndDelete({ _id: req.params.id, userId }).lean();
      if (!doc) return res.status(404).json({ error: 'Cration not found or not yours' });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  };

  view = async (req: Request, res: Response) => {
    try {
      await this.CrationModel.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  };
}
