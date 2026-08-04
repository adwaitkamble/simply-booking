import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUserPayload } from '@hotel-pms/types';

export const JWT_SECRET = process.env.JWT_SECRET || 'simply-booking-super-secret-jwt-key-2026';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

/**
 * Authentication Middleware: Enforces JWT verification & injects tenant context
 */
export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. No Bearer token provided.',
      statusCode: 401,
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;

    if (!decoded || !decoded.userId || !decoded.propertyId) {
      res.status(401).json({
        success: false,
        error: 'Invalid authentication token claims.',
        statusCode: 401,
      });
      return;
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token.',
      statusCode: 401,
    });
    return;
  }
};
