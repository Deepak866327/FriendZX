import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { LoginUseCase } from '../../application/usecases/LoginUseCase';
import { RegisterUseCase } from '../../application/usecases/RegisterUseCase';
import { ChangePasswordUseCase } from '../../application/usecases/ChangePasswordUseCase';
import { Logger } from '../../../../../shared/utils/logger';
import { LoginDTO, RegisterDTO } from '../../application/dto/AuthDTO';

const logger = new Logger('AuthController');

export class AuthController {
  constructor(
    private loginUseCase: LoginUseCase,
    private registerUseCase: RegisterUseCase,
    private changePasswordUseCase: ChangePasswordUseCase
  ) {}

  async login(req: Request, res: Response) {
    try {
      // Accept `identifier` (new) or fall back to legacy `email` field
      const identifier: string = (req.body.identifier || req.body.email || '').trim();
      const { password } = req.body;

      if (!identifier || !password) {
        return res.status(400).json({ error: 'Username/email and password are required' });
      }

      const result = await this.loginUseCase.execute({ identifier, password });
      res.json(result);
    } catch (error) {
      logger.error(`Login error: ${(error as Error).message}`);
      res.status(401).json({ error: (error as Error).message });
    }
  }

  async register(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName }: RegisterDTO = req.body;

      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: 'All fields required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const result = await this.registerUseCase.execute({
        email,
        password,
        firstName,
        lastName,
      });
      res.status(201).json(result);
    } catch (error) {
      logger.error(`Registration error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      res.json({ userId });
    } catch (error) {
      logger.error(`Get profile error: ${(error as Error).message}`);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  async googleCallback(req: Request, res: Response) {
    try {
      const result = req.user as any;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const params = new URLSearchParams({
        token: result.token,
        refreshToken: result.refreshToken,
        user: JSON.stringify(result.user),
      });
      res.redirect(`${frontendUrl}/auth/callback?${params}`);
    } catch (error) {
      logger.error(`Google callback error: ${(error as Error).message}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }

  async changePassword(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'No token provided' });

      let userId: string;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        userId = decoded.id;
      } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new password are required' });
      }

      await this.changePasswordUseCase.execute(userId, currentPassword, newPassword);
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      logger.error(`Change password error: ${(error as Error).message}`);
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      logger.error(`Logout error: ${(error as Error).message}`);
      res.status(500).json({ error: 'Failed to logout' });
    }
  }
}