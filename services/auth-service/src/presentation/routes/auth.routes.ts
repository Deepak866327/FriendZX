import { Router, Request, Response } from 'express';
import passport from 'passport';
import { AuthController } from '../controllers/AuthController';

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.post('/register', (req: Request, res: Response) => controller.register(req, res));
  router.post('/login', (req: Request, res: Response) => controller.login(req, res));
  router.post('/logout', (req: Request, res: Response) => controller.logout(req, res));
  router.post('/change-password', (req: Request, res: Response) => controller.changePassword(req, res));
  router.get('/profile', (req: Request, res: Response) => controller.getProfile(req, res));
  router.get('/health', (req: Request, res: Response) => res.json({ status: 'ok' }));

  // Google OAuth
  const googleConfigured = !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);

  router.get('/google', (req: Request, res: Response, next) => {
    if (!googleConfigured) {
      return res.status(503).json({ error: 'Google OAuth is not configured on this server' });
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  });

  router.get('/google/callback', (req: Request, res: Response, next) => {
    if (!googleConfigured) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=oauth_failed`,
    })(req, res, next);
  }, (req: Request, res: Response) => controller.googleCallback(req, res));

  return router;
}
