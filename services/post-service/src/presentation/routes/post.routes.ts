import { Router } from 'express';
import { PostController } from '../controllers/PostController';

export function createPostRoutes(ctrl: PostController): Router {
  const router = Router();

  // Feed endpoints
  router.get('/feed',           ctrl.publicFeed);
  router.get('/feed/friends',   ctrl.friendsFeed);
  router.get('/feed/nearby',    ctrl.nearbyFeed);
  router.get('/reels',          ctrl.reelsFeed);

  // User posts
  router.get('/user/:userId',   ctrl.userPosts);

  // Post CRUD
  router.post('/',              ctrl.createPost);
  router.get('/:id',            ctrl.getPost);
  router.delete('/:id',         ctrl.deletePost);

  // Reactions
  router.post('/:id/like',      ctrl.likePost);
  router.delete('/:id/like',    ctrl.unlikePost);

  return router;
}
