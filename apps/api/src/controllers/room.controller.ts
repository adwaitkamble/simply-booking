import { Request, Response, NextFunction } from 'express';
import { RoomService } from '../services/room.service.js';
import { PropertyService } from '../services/property.service.js';
import type { RoomStatus } from '@hotel-pms/types';

export class RoomController {
  /**
   * GET /api/properties/:propertyId/rooms
   */
  static async getPropertyRooms(req: Request, res: Response, next: NextFunction) {
    try {
      const propertyId = req.params.propertyId as string;

      // Validate tenant isolation
      if (req.user && req.user.propertyId !== propertyId) {
        return res.status(403).json({
          success: false,
          error: 'Access forbidden: You cannot view rooms outside your property.',
        });
      }

      const rooms = await RoomService.getRoomsByProperty(propertyId);
      res.json({
        success: true,
        count: rooms.length,
        data: rooms,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rooms/available
   * Query params: checkIn, checkOut
   */
  static async getAvailableRooms(req: Request, res: Response, next: NextFunction) {
    try {
      const { checkIn, checkOut } = req.query;
      let propertyId = req.user?.propertyId || (req.query.propertyId as string | undefined);

      if (!propertyId) {
        const defaultProp = await PropertyService.getDefaultProperty();
        propertyId = defaultProp.id;
      }

      if (!checkIn || !checkOut) {
        return res.status(400).json({
          success: false,
          error: 'Query parameters "checkIn" and "checkOut" are required (e.g. ?checkIn=2026-09-01&checkOut=2026-09-05)',
        });
      }

      const availableRooms = await RoomService.getAvailableRooms(
        checkIn as string,
        checkOut as string,
        propertyId
      );

      res.json({
        success: true,
        count: availableRooms.length,
        data: availableRooms,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rooms/housekeeping
   * Fetches rooms requiring cleaning/maintenance for tenant property
   */
  static async getHousekeepingRooms(req: Request, res: Response, next: NextFunction) {
    try {
      let propertyId = req.user?.propertyId || (req.query.propertyId as string | undefined);

      if (!propertyId) {
        const defaultProp = await PropertyService.getDefaultProperty();
        propertyId = defaultProp.id;
      }

      const rooms = await RoomService.getHousekeepingRooms(propertyId);
      res.json({
        success: true,
        count: rooms.length,
        data: rooms,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/rooms/:roomId/status
   * Updates room status and creates turnover log
   */
  static async updateRoomStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const roomId = req.params.roomId as string;
      const { status, staffId } = req.body;
      let propertyId = req.user?.propertyId;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Field "status" is required in request body (Clean, Dirty, or Maintenance)',
        });
      }

      const result = await RoomService.updateRoomStatus(
        roomId,
        status as RoomStatus,
        staffId as string | undefined,
        propertyId
      );

      res.json({
        success: true,
        message: `Room status updated to ${status}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rooms
   * Creates a new room on the fly for the tenant property
   */
  static async createRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const { roomNumber, pricePerNight, roomSize, roomCategoryId, status } = req.body;
      let propertyId = req.user?.propertyId;

      if (!propertyId) {
        const defaultProp = await PropertyService.getDefaultProperty();
        propertyId = defaultProp.id;
      }

      if (!roomNumber) {
        return res.status(400).json({
          success: false,
          error: 'Field "roomNumber" is required',
        });
      }

      const newRoom = await RoomService.createRoom({
        roomNumber,
        pricePerNight: pricePerNight !== undefined && pricePerNight !== null ? Number(pricePerNight) : undefined,
        roomSize: typeof roomSize === 'string' ? roomSize : undefined,
        roomCategoryId,
        status,
        propertyId,
      });

      res.status(201).json({
        success: true,
        message: `Room ${roomNumber} created successfully`,
        data: newRoom,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rooms/categories
   * Creates a new room category dynamically for tenant property
   */
  static async createRoomCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description, basePrice } = req.body;
      let propertyId = req.user?.propertyId || (req.body as any).propertyId;

      if (!propertyId) {
        const defaultProp = await PropertyService.getDefaultProperty();
        propertyId = defaultProp.id;
      }

      if (!name || !String(name).trim()) {
        return res.status(400).json({
          success: false,
          error: 'Field "name" is required for room category',
        });
      }

      const newCategory = await RoomService.createRoomCategory({
        name,
        description,
        basePrice,
        propertyId,
      });

      res.status(201).json({
        success: true,
        message: `Room Category "${name}" created successfully`,
        data: newCategory,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rooms/categories
   * Fetches all room categories for tenant property
   */
  static async getRoomCategories(req: Request, res: Response, next: NextFunction) {
    try {
      let propertyId = req.user?.propertyId || (req.query.propertyId as string | undefined);

      if (!propertyId) {
        const defaultProp = await PropertyService.getDefaultProperty();
        propertyId = defaultProp.id;
      }

      const categories = await RoomService.getRoomCategories(propertyId);

      res.json({
        success: true,
        count: categories.length,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/rooms/:roomId
   * Deletes a room by ID with reservation checks
   */
  static async deleteRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const roomId = req.params.roomId as string;
      let propertyId = req.user?.propertyId;

      if (!propertyId) {
        const defaultProp = await PropertyService.getDefaultProperty();
        propertyId = defaultProp.id;
      }

      const result = await RoomService.deleteRoom(roomId, propertyId);

      res.json({
        success: true,
        message: `Room #${result.roomNumber} deleted successfully`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/rooms/categories/:categoryId
   * Deletes a room category by ID
   */
  static async deleteRoomCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId = req.params.categoryId as string;
      let propertyId = req.user?.propertyId;

      if (!propertyId) {
        const defaultProp = await PropertyService.getDefaultProperty();
        propertyId = defaultProp.id;
      }

      const result = await RoomService.deleteRoomCategory(categoryId, propertyId);

      res.json({
        success: true,
        message: `Room Category "${result.categoryName}" deleted successfully`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rooms
   * Returns stats { total, used } and rooms array for inventory screen
   */
  static async getRoomsInventory(req: Request, res: Response, next: NextFunction) {
    try {
      let propertyId = req.user?.propertyId;

      if (!propertyId) {
        const defaultProp = await PropertyService.getDefaultProperty();
        propertyId = defaultProp.id;
      }

      const inventory = await RoomService.getRoomsInventory(propertyId);

      res.json({
        success: true,
        stats: inventory.stats,
        rooms: inventory.rooms,
      });
    } catch (error) {
      next(error);
    }
  }
}
