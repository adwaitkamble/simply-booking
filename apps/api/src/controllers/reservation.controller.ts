import { Request, Response, NextFunction } from 'express';
import { ReservationService } from '../services/reservation.service.js';

export class ReservationController {
  /**
   * POST /api/reservations
   */
  static async createReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const propertyId = req.user?.propertyId;
      const reservation = await ReservationService.createReservationWithLock({
        ...req.body,
        propertyId,
      });
      res.status(201).json({
        success: true,
        message: 'Reservation booked successfully',
        data: reservation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reservations
   */
  static async getReservations(req: Request, res: Response, next: NextFunction) {
    try {
      const propertyId = req.user?.propertyId;
      const reservations = await ReservationService.getAllReservations(propertyId);
      res.json({
        success: true,
        count: reservations.length,
        data: reservations,
      });
    } catch (error) {
      next(error);
    }
  }
}
