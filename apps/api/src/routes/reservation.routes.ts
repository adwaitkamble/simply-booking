import { Router } from 'express';
import { ReservationController } from '../controllers/reservation.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

export const reservationRouter = Router();

// Protect all reservation routes
reservationRouter.use(authenticateUser);

// POST /api/reservations (Core Booking with Concurrency Lock)
reservationRouter.post('/', ReservationController.createReservation);

// GET /api/reservations
reservationRouter.get('/', ReservationController.getReservations);
