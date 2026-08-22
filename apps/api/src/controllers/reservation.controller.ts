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

  /**
   * GET /api/bookings
   * Accepts query parameters: startDate, endDate
   */
  static async getBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const propertyId = req.user?.propertyId;
      const { startDate, endDate } = req.query;

      const bookings = await ReservationService.getBookings(
        startDate as string | undefined,
        endDate as string | undefined,
        propertyId
      );

      res.json({
        success: true,
        count: bookings.length,
        data: bookings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/reservations/:id/whatsapp
   * Triggers WhatsApp confirmation message for a reservation
   */
  static async sendWhatsAppConfirmation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const reservation = await ReservationService.getAllReservations();
      const target = reservation.find((r) => r.id === id);

      if (!target) {
        return res.status(404).json({ success: false, error: 'Reservation not found' });
      }

      const total = Number(target.totalAmount || 0);
      const advance = Number(target.advancePaid || 0);
      const pending = Math.max(0, total - advance);

      const result = await ReservationService.sendWhatsAppNotification({
        guestName: target.guest?.name || 'Guest',
        guestPhone: target.guest?.phone || '',
        propertyName: target.room?.roomCategory?.property?.name || 'Simply Booking Hotel',
        roomNumber: target.room?.roomNumber || '',
        checkIn: target.checkIn.toISOString().slice(0, 10),
        checkOut: target.checkOut.toISOString().slice(0, 10),
        totalAmount: total,
        pendingAmount: pending,
        currency: target.room?.roomCategory?.property?.currency || 'INR',
      });

      res.json({
        success: true,
        message: 'WhatsApp notification triggered',
        result,
      });
    } catch (error) {
      next(error);
    }
  }
}
