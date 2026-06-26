import { Router } from 'express';
import { Multer } from 'multer';
import { CommunityController } from '../controllers/CommunityController';
import { authMiddleware } from '../middleware/errorHandler';

export function createCommunityRoutes(controller: CommunityController, upload: Multer): Router {
  const router = Router();

  router.use(authMiddleware);

  // Discovery & user communities (aliases kept for backward compat)
  router.get('/mine',     controller.mine);
  router.get('/my',       controller.mine);      // alias
  router.get('/nearby',   controller.discover);  // alias
  router.get('/discover', controller.discover);
  router.get('/feed',     controller.myFeed);

  // Community CRUD
  router.post('/',    upload.single('coverImage'), controller.create);
  router.get('/:id',  controller.getOne);
  router.put('/:id',  upload.single('coverImage'), controller.update);
  router.delete('/:id', controller.remove);

  // Membership
  router.post('/:id/join',  controller.join);
  router.post('/:id/leave', controller.leave);
  router.post('/:id/members',                      controller.addMember);
  router.delete('/:id/members/:targetUserId',      controller.removeMember);

  // Community posts
  router.get('/:id/feed',  controller.feed);
  router.post('/:id/posts', upload.array('images', 10), controller.createPost);

  return router;
}
