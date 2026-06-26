import { Router } from 'express';
import { Multer } from 'multer';
import { CrationController } from '../controllers/CrationController';
import { authMiddleware } from '../middleware/errorHandler';

export function createCrationRoutes(controller: CrationController, upload: Multer): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/feed/public',    controller.publicFeed);
  router.get('/feed/friends',   controller.friendsFeed);
  router.get('/feed/nearby',    controller.nearbyFeed);
  router.get('/feed',           controller.feed);
  router.get('/user/:userId',   controller.userCrations);
  router.post('/',              upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), controller.create);
  router.post('/:id/like',      controller.like);
  router.delete('/:id/like',    controller.unlike);
  router.post('/:id/view',      controller.view);
  router.delete('/:id',         controller.remove);

  return router;
}
