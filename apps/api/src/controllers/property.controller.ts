import { Request, Response, NextFunction } from 'express';
import { PropertyService } from '../services/property.service.js';

export class PropertyController {
  /**
   * GET /api/properties/default
   * Fetches the primary in-house hotel property for the authenticated user
   */
  static async getDefaultProperty(req: Request, res: Response, next: NextFunction) {
    try {
      const propertyId = req.user?.propertyId;
      const property = await PropertyService.getDefaultProperty(propertyId);
      res.json({
        success: true,
        data: property,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/properties
   * Fetches properties for the authenticated user
   */
  static async getAllProperties(req: Request, res: Response, next: NextFunction) {
    try {
      const propertyId = req.user?.propertyId;
      const properties = await PropertyService.getAllProperties(propertyId);
      res.json({
        success: true,
        count: properties.length,
        data: properties,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/properties/:propertyId
   */
  static async getPropertyById(req: Request, res: Response, next: NextFunction) {
    try {
      const propertyId = req.params.propertyId as string;

      // Ensure tenant isolation: user can only query their own property
      if (req.user && req.user.propertyId !== propertyId) {
        return res.status(403).json({
          success: false,
          error: 'Access forbidden: You cannot view properties outside your organization.',
        });
      }

      const property = await PropertyService.getPropertyById(propertyId);
      res.json({
        success: true,
        data: property,
      });
    } catch (error) {
      next(error);
    }
  }
}
