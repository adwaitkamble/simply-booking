import { Router } from 'express';
import { RoomController } from '../controllers/room.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

export const roomRouter = Router();

// Protect all room routes
roomRouter.use(authenticateUser);

// GET /api/rooms/available - Query available rooms by date
roomRouter.get('/available', RoomController.getAvailableRooms);

// GET /api/rooms/housekeeping - Query rooms requiring cleaning or maintenance
roomRouter.get('/housekeeping', RoomController.getHousekeepingRooms);

// PATCH /api/rooms/:roomId/status - Update status (Clean/Dirty/Maintenance) & emit real-time event
roomRouter.patch('/:roomId/status', RoomController.updateRoomStatus);

// POST /api/rooms - Create a new room on the fly
roomRouter.post('/', RoomController.createRoom);
