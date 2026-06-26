import { Router } from 'express';
import { MediaController } from '../controllers/MediaController';

export function createMediaRoutes(ctrl: MediaController): Router {
  const router = Router();

  router.post('/presigned-url',    ctrl.presignedUrl);
  router.post('/complete-upload',  ctrl.completeUpload);
  router.put('/local-upload/*',    ctrl.localUpload);  // wildcard captures full encoded key
  router.get('/:id',               ctrl.getMedia);
  router.delete('/:id',            ctrl.deleteMedia);

  return router;
}
