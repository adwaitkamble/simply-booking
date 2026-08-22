import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Register a new property and owner account
 */
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Sign in to an existing property account
 */
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile and property
 */
authRouter.get('/me', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await AuthService.getMe(userId);
    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/change-password
 * Change password for current authenticated user
 */
authRouter.post('/change-password', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const result = await AuthService.changePassword(userId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
