import { Request, Response, NextFunction } from 'express';
import { TeamService } from '../services/team.service.js';

export class TeamController {
  /**
   * GET /api/team
   * Fetch team members and subscription limit stats
   */
  static async getTeamData(req: Request, res: Response, next: NextFunction) {
    try {
      const propertyId = req.user!.propertyId;
      const data = await TeamService.getTeamData(propertyId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/team/:id/status
   * Toggle active/inactive state of a team member
   */
  static async updateMemberStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const memberId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Field "isActive" must be a boolean (true/false).',
        });
      }

      const result = await TeamService.updateMemberStatus(memberId, isActive);
      res.json({
        success: true,
        message: `Member status updated to ${isActive ? 'active' : 'inactive'}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/team/:id
   * Remove team member
   */
  static async deleteMember(req: Request, res: Response, next: NextFunction) {
    try {
      const memberId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const propertyId = req.user!.propertyId;

      await TeamService.deleteMember(memberId, propertyId);
      res.json({
        success: true,
        message: 'Team member removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/team/create-member
   * Create staff member
   */
  static async createMember(req: Request, res: Response, next: NextFunction) {
    try {
      const propertyId = req.user!.propertyId;
      const newMember = await TeamService.createMember(propertyId, req.body);

      res.status(201).json({
        success: true,
        message: 'Team member created successfully',
        data: newMember,
      });
    } catch (error) {
      next(error);
    }
  }
}
