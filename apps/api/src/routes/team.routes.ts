import { Router, Request, Response, NextFunction } from 'express';
import { TeamService } from '../services/team.service.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';
import { requireAdmin, requirePermission } from '../middlewares/rbac.middleware.js';

export const teamRouter = Router();

// All team routes require authentication
teamRouter.use(authenticateUser);

/**
 * GET /api/team
 * List all team members under property (Requires team:view or team:list)
 */
teamRouter.get('/', requirePermission('team', 'list'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId;
    const members = await TeamService.listMembers(propertyId);
    res.json({
      success: true,
      data: members,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/team/create-member
 * Restricted to Admin role. Creates staff user account with permissions.
 */
teamRouter.post('/create-member', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId;
    const newMember = await TeamService.createMember(propertyId, req.body);
    res.status(201).json({
      success: true,
      data: newMember,
      message: 'Team member account created successfully.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/team/:id
 * Restricted to Admin role. Update staff member's permissions, status, or role.
 */
teamRouter.put('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId;
    const memberId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updatedMember = await TeamService.updateMember(memberId, propertyId, req.body);
    res.json({
      success: true,
      data: updatedMember,
      message: 'Team member updated successfully.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/team/:id
 * Restricted to Admin role. Deletes a team member.
 */
teamRouter.delete('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId;
    const memberId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await TeamService.deleteMember(memberId, propertyId);
    res.json({
      success: true,
      message: 'Team member deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
});
