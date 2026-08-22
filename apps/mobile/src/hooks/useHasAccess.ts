import { useAuth } from '../context/AuthContext';
import { ActionPermissions } from '@hotel-pms/types';

/**
 * Custom Hook for Granular Role-Based Access Control (RBAC) UI Guards
 * @param moduleName Module identifier (e.g., 'calendar', 'rooms', 'bookings', 'invoicing', 'housekeeping', 'team')
 * @param action Specific action identifier ('create' | 'edit' | 'view' | 'delete' | 'list')
 * @returns boolean indicating if the logged-in user is authorized
 * 
 * Example Usage in UI:
 * ```tsx
 * const canDeleteRoom = useHasAccess('rooms', 'delete');
 * if (!canDeleteRoom) return null; // Hides delete button if unauthorized
 * ```
 */
export const useHasAccess = (
  moduleName: string,
  action: keyof ActionPermissions
): boolean => {
  const { user } = useAuth();

  if (!user) return false;

  // Account deactivation guard
  if (user.isActive === false) return false;

  // 1. Admin Role Bypass (Super-User)
  if (user.role === 'Admin') {
    return true;
  }

  // 2. Staff Role Granular Permission Check
  const permissions: any = user.permissions || {};
  const modulePerms = permissions[moduleName];

  if (modulePerms && modulePerms[action] === true) {
    return true;
  }

  return false;
};
