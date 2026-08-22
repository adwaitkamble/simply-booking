import type { Request, Response, NextFunction } from 'express';

/**
 * Dynamic RBAC Middleware: Enforces module and action level permissions.
 * - Admin role always bypasses permission checks (super-user).
 * - Staff role verifies nested JSON permission path (e.g. req.user.permissions[module][action]).
 */
export const requirePermission = (moduleName: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.',
        statusCode: 401,
      });
      return;
    }

    // Check account status
    if (user.isActive === false) {
      res.status(403).json({
        success: false,
        error: 'Account is deactivated. Please contact your property administrator.',
        statusCode: 403,
      });
      return;
    }

    // 1. Admin Role Bypass
    if (user.role === 'Admin') {
      next();
      return;
    }

    // 2. Staff Role Granular Permission Check
    const permissions: any = user.permissions || {};
    const modulePerms = permissions[moduleName];

    if (modulePerms && modulePerms[action] === true) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: `Access Denied: You do not have permission to ${action} ${moduleName}.`,
      statusCode: 403,
    });
  };
};

/**
 * Require Admin Role Middleware
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }

  if (req.user.role !== 'Admin') {
    res.status(403).json({
      success: false,
      error: 'Access Denied: Only Administrator accounts can perform this action.',
      statusCode: 403,
    });
    return;
  }

  next();
};
