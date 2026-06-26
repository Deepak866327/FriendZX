import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

import { Logger } from '../../../shared/utils/logger';
import { KafkaProducer } from '../../../shared/adapters/kafka/KafkaProducer';

import { getPrisma } from './infrastructure/prisma/client';
import { S3StorageAdapter } from './infrastructure/adapters/storage/S3StorageAdapter';
import { PrismaMediaRepository } from './infrastructure/adapters/database/PrismaMediaRepository';
import { PrismaPostRepository } from './infrastructure/adapters/database/PrismaPostRepository';
import { MediaEventProducer } from './infrastructure/kafka/MediaEventProducer';

import { CreatePresignedUrlUseCase } from './application/usecases/CreatePresignedUrlUseCase';
import { CompleteUploadUseCase } from './application/usecases/CompleteUploadUseCase';
import { CreatePostUseCase } from './application/usecases/CreatePostUseCase';
import { GetFeedUseCase } from './application/usecases/GetPublicFeedUseCase';
import { DeletePostUseCase } from './application/usecases/DeletePostUseCase';
import { LikePostUseCase } from './application/usecases/LikePostUseCase';

import { MediaController } from './presentation/controllers/MediaController';
import { PostController } from './presentation/controllers/PostController';
import { createMediaRoutes } from './presentation/routes/media.routes';
import { createPostRoutes } from './presentation/routes/post.routes';

// ── Legacy controllers (communities, crations, stories) kept on MongoDB ──────
import { CommunityController } from './presentation/controllers/CommunityController';
import { createCommunityRoutes } from './presentation/routes/community.routes';
import { CrationController } from './presentation/controllers/CrationController';
import { createCrationRoutes } from './presentation/routes/cration.routes';

dotenv.config();

const app    = express();
const logger = new Logger('PostService');
const PORT   = process.env.PORT || 3006;

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
// Raw body for local S3-style uploads (PUT with binary body)
// Raw body parser for local S3-style uploads (wildcard covers full key path)
app.use('/media/local-upload', express.raw({ type: '*/*', limit: '210mb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const uploadLimiter = rateLimit({ windowMs: 60_000, max: 30, message: 'Too many upload requests' });
const feedLimiter   = rateLimit({ windowMs: 60_000, max: 120 });

// ── Auth middleware (stamps x-user-id set by gateway) ────────────────────────
app.use((req, _res, next) => {
  (req as any).userId = req.headers['x-user-id'] as string;
  next();
});

// ── Infrastructure ────────────────────────────────────────────────────────────
const storage      = new S3StorageAdapter();
const prisma       = getPrisma();
const kafkaProducer = new KafkaProducer('post-service');
const mediaRepo    = new PrismaMediaRepository(prisma);
const postRepo     = new PrismaPostRepository(prisma);
const events       = new MediaEventProducer(kafkaProducer);

// ── Use cases ─────────────────────────────────────────────────────────────────
const createPresignedUrl = new CreatePresignedUrlUseCase(storage, mediaRepo, events);
const completeUpload     = new CompleteUploadUseCase(storage, mediaRepo, events);
const createPost         = new CreatePostUseCase(postRepo, mediaRepo, events);
const getFeed            = new GetFeedUseCase(postRepo);
const deletePost         = new DeletePostUseCase(postRepo, mediaRepo, storage);
const likePost           = new LikePostUseCase(postRepo);

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';

// ── Controllers & Routes ──────────────────────────────────────────────────────
const mediaCtrl = new MediaController(createPresignedUrl, completeUpload, mediaRepo, storage);
const postCtrl  = new PostController(createPost, getFeed, deletePost, likePost, storage, USER_SERVICE_URL, postRepo);

app.get('/health', (_req, res) => res.json({ status: 'Post Service running', storage: storage.isLocalMode() ? 'local' : 's3' }));
app.use('/media', uploadLimiter, createMediaRoutes(mediaCtrl));
app.use('/',      feedLimiter,   createPostRoutes(postCtrl));

// ── Local file serving (dev only) ─────────────────────────────────────────────
if (storage.isLocalMode()) {
  const localDir = storage.getLocalDir();
  app.use('/media/file', (req, res, next) => {
    const key      = decodeURIComponent(req.path.slice(1));
    const filePath = path.join(localDir, ...key.split('/'));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
  });
  logger.info(`Local storage mode — files served from ${localDir}`);
}

// ── MongoDB legacy: Communities, Crations, Stories, Comments ──────────────────
const crationSchema = new mongoose.Schema({
  userId:       { type: String, required: true, index: true },
  caption:      { type: String, default: '' },
  videoUrl:     { type: String, required: true },
  thumbnailUrl: { type: String },
  visibility:   { type: String, enum: ['public', 'friends', 'nearby'], default: 'public' },
  nearbyRadius: { type: Number },
  location:     { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number] } },
  likes:        { type: [String], default: [] },
  likesCount:   { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  sharesCount:  { type: Number, default: 0 },
  views:        { type: Number, default: 0 },
  createdAt:    { type: Date, default: Date.now, index: true },
});
crationSchema.index({ createdAt: -1 });
crationSchema.index({ location: '2dsphere' });
const CrationModel = mongoose.model('Cration', crationSchema);

const communitySchema = new mongoose.Schema({
  name:         { type: String, required: true },
  description:  { type: String, default: '' },
  coverImage:   { type: String },
  mode:         { type: String, enum: ['private', 'public'], required: true },
  visibility:   { type: String, enum: ['public', 'nearby'] },
  nearbyRadius: { type: Number },
  location:     { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number] } },
  adminId:      { type: String, required: true, index: true },
  members:      { type: [String], default: [] },
  memberCount:  { type: Number, default: 0 },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now },
});
communitySchema.index({ location: '2dsphere' });
const CommunityModel = mongoose.model('Community', communitySchema);

const commentSchema = new mongoose.Schema({
  parentId:   { type: String, required: true },
  parentType: { type: String, enum: ['post', 'cration'], required: true },
  userId:     { type: String, required: true },
  text:       { type: String, required: true, maxlength: 500 },
}, { timestamps: true });
commentSchema.index({ parentId: 1, parentType: 1, createdAt: -1 });
const CommentModel = mongoose.model('Comment', commentSchema);

const storySchema = new mongoose.Schema({
  userId:      { type: String, required: true, index: true },
  mediaUrl:    { type: String, required: true },
  mediaType:   { type: String, enum: ['image', 'video'], required: true },
  text:        { type: String, default: '' },
  visibility:  { type: String, enum: ['public', 'friends', 'nearby'], default: 'public' },
  nearbyRadius:{ type: Number },
  location:    { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number] } },
  viewers:     { type: [String], default: [] },
  viewCount:   { type: Number, default: 0 },
  expiresAt:   { type: Date, required: true },
}, { timestamps: true });
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ location: '2dsphere' });
const StoryModel = mongoose.model('Story', storySchema);

// ── Multer for legacy cration/story/community uploads ─────────────────────────
import multer from 'multer';

function diskStorage(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename:    (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  });
}

const LEGACY_DIR  = path.join(process.cwd(), 'legacy-uploads');
const videoUpload = multer({ storage: diskStorage(path.join(LEGACY_DIR, 'crations')), limits: { fileSize: 200 * 1024 * 1024 } });
const imageUpload = multer({ storage: diskStorage(path.join(LEGACY_DIR, 'community')), limits: { fileSize: 20 * 1024 * 1024 } });
const storyUpload = multer({ storage: diskStorage(path.join(LEGACY_DIR, 'stories')),  limits: { fileSize: 50 * 1024 * 1024 } });

app.use('/legacy-uploads',   express.static(LEGACY_DIR));
// Keep old upload paths so existing api-gateway proxies still work
app.use('/crations/uploads', express.static(path.join(LEGACY_DIR, 'crations')));
app.use('/uploads',          express.static(path.join(LEGACY_DIR, 'community')));
app.use('/stories/uploads',  express.static(path.join(LEGACY_DIR, 'stories')));
// Prevent missing static files from falling through to auth-gated routers
app.use('/crations/uploads', (_req, res) => res.status(404).end());
app.use('/stories/uploads',  (_req, res) => res.status(404).end());

// Minimal community-post schema (kept in MongoDB for community feature)
const communityPostSchema = new mongoose.Schema({
  userId:        { type: String, required: true, index: true },
  content:       { type: String, default: '' },
  mediaUrls:     { type: [String], default: [] },
  visibility:    { type: String, enum: ['public', 'private', 'nearby'], required: true },
  communityId:   { type: String, index: true },
  communityName: { type: String },
  nearbyRadius:  { type: Number },
  location:      { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number] } },
  likes:         { type: [String], default: [] },
  likesCount:    { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  sharesCount:   { type: Number, default: 0 },
  views:         { type: Number, default: 0 },
  createdAt:     { type: Date, default: Date.now, index: true },
  updatedAt:     { type: Date, default: Date.now },
});
communityPostSchema.index({ location: '2dsphere' });
const CommunityPostModel = mongoose.model('CommunityPost', communityPostSchema);

const communityCtrl = new CommunityController(CommunityModel, CommunityPostModel);
const crationCtrl   = new CrationController(CrationModel, USER_SERVICE_URL);

app.use('/communities', createCommunityRoutes(communityCtrl, imageUpload));
app.use('/crations',    createCrationRoutes(crationCtrl, videoUpload));

// ── Stories ───────────────────────────────────────────────────────────────────
const STORY_TTL = 24 * 60 * 60 * 1000;

app.post('/stories', storyUpload.single('media'), async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const file = (req as any).file as Express.Multer.File;
  if (!file) return res.status(400).json({ error: 'Media file required' });
  const { text = '', visibility = 'public', nearbyRadius, latitude, longitude } = req.body;
  const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
  const mediaUrl  = `/legacy-uploads/stories/${file.filename}`;
  const storyData: any = { userId, mediaUrl, mediaType, text, visibility, expiresAt: new Date(Date.now() + STORY_TTL) };
  if (visibility === 'nearby' && latitude && longitude) {
    storyData.nearbyRadius = parseFloat(nearbyRadius) || 10;
    storyData.location = { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] };
  }
  try {
    res.status(201).json(await StoryModel.create(storyData));
  } catch (err) { res.status(500).json({ error: 'Failed to create story' }); }
});

app.get('/stories/feed', async (req, res) => {
  const userId = (req as any).userId;
  const { latitude, longitude } = req.query;
  const now = new Date();
  try {
    const stories = await StoryModel.find({ expiresAt: { $gt: now }, visibility: { $in: ['public', 'friends'] } })
      .sort({ createdAt: -1 }).limit(200).lean();
    if (latitude && longitude) {
      const nearbyStories = await StoryModel.find({
        expiresAt: { $gt: now }, visibility: 'nearby',
        location: { $nearSphere: { $geometry: { type: 'Point', coordinates: [parseFloat(longitude as string), parseFloat(latitude as string)] }, $maxDistance: 50000 } },
      }).sort({ createdAt: -1 }).limit(100).lean();
      stories.push(...nearbyStories);
    }
    const myStories = await StoryModel.find({ userId, expiresAt: { $gt: now } }).sort({ createdAt: -1 }).lean();
    const allIds = new Set(stories.map((s: any) => String(s._id)));
    myStories.forEach((s: any) => { if (!allIds.has(String(s._id))) stories.push(s); });
    const groups: Record<string, any[]> = {};
    for (const s of stories) {
      const uid = (s as any).userId;
      if (!groups[uid]) groups[uid] = [];
      groups[uid].push({ id: String((s as any)._id), userId: uid, mediaUrl: (s as any).mediaUrl, mediaType: (s as any).mediaType, text: (s as any).text, visibility: (s as any).visibility, viewers: (s as any).viewers || [], viewCount: (s as any).viewCount || 0, createdAt: (s as any).createdAt, expiresAt: (s as any).expiresAt });
    }
    const result = Object.entries(groups).map(([uid, userStories]) => ({
      userId: uid, stories: userStories, hasUnseen: userStories.some(s => !s.viewers.includes(userId)),
    })).sort((a, b) => {
      if (a.userId === userId) return -1;
      if (b.userId === userId) return 1;
      if (a.hasUnseen && !b.hasUnseen) return -1;
      if (!a.hasUnseen && b.hasUnseen) return 1;
      return 0;
    });
    res.json({ groups: result });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch stories' }); }
});

app.get('/stories/user/:userId', async (req, res) => {
  const viewerId = (req as any).userId;
  try {
    const stories = await StoryModel.find({ userId: req.params.userId, expiresAt: { $gt: new Date() } }).sort({ createdAt: 1 }).lean();
    res.json({ stories: stories.map((s: any) => ({ id: String(s._id), userId: s.userId, mediaUrl: s.mediaUrl, mediaType: s.mediaType, text: s.text, visibility: s.visibility, viewers: s.viewers, viewCount: s.viewCount, createdAt: s.createdAt, expiresAt: s.expiresAt, seen: viewerId ? s.viewers.includes(viewerId) : false })) });
  } catch { res.status(500).json({ error: 'Failed to fetch stories' }); }
});

app.post('/stories/:id/view', async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await StoryModel.updateOne({ _id: req.params.id }, { $addToSet: { viewers: userId }, $inc: { viewCount: 1 } });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/stories/:id', async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const story = await StoryModel.findOneAndDelete({ _id: req.params.id, userId });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    const file = path.join(LEGACY_DIR, 'stories', path.basename((story as any).mediaUrl));
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Comments (shared between posts and crations) ──────────────────────────────
async function getComments(parentId: string, parentType: string, limit = 50) {
  const docs = await CommentModel.find({ parentId, parentType }).sort({ createdAt: -1 }).limit(limit).lean();
  return docs.map((c: any) => ({ id: String(c._id), parentId: c.parentId, parentType: c.parentType, userId: c.userId, text: c.text, createdAt: c.createdAt }));
}

// Post comments
app.get('/posts/:id/comments',             async (req, res) => { try { res.json({ comments: await getComments(req.params.id, 'post') }); } catch { res.status(500).json({ error: 'Failed' }); } });
app.post('/posts/:id/comments',            async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  try {
    const c = await CommentModel.create({ parentId: req.params.id, parentType: 'post', userId, text: text.trim() });
    res.status(201).json({ id: String((c as any)._id), userId, text: text.trim(), createdAt: (c as any).createdAt });
  } catch { res.status(500).json({ error: 'Failed' }); }
});
app.delete('/posts/:id/comments/:cid',     async (req, res) => {
  const userId = (req as any).userId;
  try { const d = await CommentModel.findOneAndDelete({ _id: req.params.cid, userId }); if (!d) return res.status(404).json({ error: 'Not found' }); res.json({ ok: true }); } catch { res.status(500).json({ error: 'Failed' }); }
});

// Cration comments
app.get('/crations/:id/comments',          async (req, res) => { try { res.json({ comments: await getComments(req.params.id, 'cration') }); } catch { res.status(500).json({ error: 'Failed' }); } });
app.post('/crations/:id/comments',         async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  try {
    const c = await CommentModel.create({ parentId: req.params.id, parentType: 'cration', userId, text: text.trim() });
    await CrationModel.updateOne({ _id: req.params.id }, { $inc: { commentsCount: 1 } });
    res.status(201).json({ id: String((c as any)._id), userId, text: text.trim(), createdAt: (c as any).createdAt });
  } catch { res.status(500).json({ error: 'Failed' }); }
});
app.delete('/crations/:id/comments/:cid', async (req, res) => {
  const userId = (req as any).userId;
  try { const d = await CommentModel.findOneAndDelete({ _id: req.params.cid, userId }); if (!d) return res.status(404).json({ error: 'Not found' }); await CrationModel.updateOne({ _id: req.params.id }, { $inc: { commentsCount: -1 } }); res.json({ ok: true }); } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/crations/:id/share', async (req, res) => {
  try { await CrationModel.updateOne({ _id: req.params.id }, { $inc: { sharesCount: 1 } }); res.json({ ok: true }); } catch { res.json({ ok: true }); }
});


// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/posts_db');
  logger.info('MongoDB connected');

  await prisma.$connect();
  logger.info('PostgreSQL (Prisma) connected');

  await kafkaProducer.connect();
  logger.info('Kafka connected');

  app.listen(PORT, () => logger.info(`Post Service v2 on port ${PORT}`));
}

start().catch(err => {
  logger.error(`Startup failed: ${err.message}`);
  process.exit(1);
});

export default app;
