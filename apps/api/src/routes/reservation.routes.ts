import { Router } from 'express';
import { ReservationController } from '../controllers/reservation.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

export const reservationRouter = Router();

// Protect all reservation routes
reservationRouter.use(authenticateUser);

// POST /api/reservations or /api/bookings
reservationRouter.post('/', ReservationController.createReservation);

// GET /api/bookings or /api/reservations (Returns mapped bookings with optional startDate/endDate)
reservationRouter.get('/', ReservationController.getBookings);

// GET /api/bookings/bookings
reservationRouter.get('/bookings', ReservationController.getBookings);

// GET /api/reservations/raw
reservationRouter.get('/raw', ReservationController.getReservations);

// POST /api/reservations/:id/whatsapp - Trigger WhatsApp Confirmation
reservationRouter.post('/:id/whatsapp', ReservationController.sendWhatsAppConfirmation);
