import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@hotel-pms/database';
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
 * Authentication Middleware: Enforces JWT verification & injects live tenant context from DB.
 */
export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
      if (decoded && decoded.userId) {
        // Fetch current user from database to ensure fresh role and permissions
        const dbUser = await prisma.users.findUnique({
          where: { id: decoded.userId },
        });

        if (dbUser) {
          req.user = {
            userId: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: (dbUser.role as any) || 'Admin',
            isActive: dbUser.isActive ?? true,
            permissions: (dbUser.permissions as any) || null,
            propertyId: dbUser.propertyId,
            propertyName: decoded.propertyName || 'Hotel Property',
          };
          next();
          return;
        }

        // Token is valid but the account no longer exists — do not fall back to
        // the stale claims embedded in the token.
        res.status(401).json({
          success: false,
          error: 'Your account is no longer available. Please sign in again.',
          statusCode: 401,
        });
        return;
      }
    } catch {
      // Invalid or expired token — fall through to the 401 below.
    }
  }

  // No valid token: reject. There is deliberately no fallback identity here —
  // one used to resolve unauthenticated requests to the owner of a "default"
  // property, which handed every anonymous caller full Admin access to that
  // tenant's data and made new accounts see another hotel's rooms.
  res.status(401).json({
    success: false,
    error: 'Authentication required. Please sign in again.',
    statusCode: 401,
  });
};
