import { Router } from 'express';
import { RoomController } from '../controllers/room.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

export const roomRouter = Router();

// Protect all room routes
roomRouter.use(authenticateUser);

// GET /api/rooms - Query rooms inventory with stats & formatted cards
roomRouter.get('/', RoomController.getRoomsInventory);

// GET /api/rooms/available - Query available rooms by date
roomRouter.get('/available', RoomController.getAvailableRooms);

// GET /api/rooms/housekeeping - Query rooms requiring cleaning or maintenance
roomRouter.get('/housekeeping', RoomController.getHousekeepingRooms);

// PATCH /api/rooms/:roomId/status - Update status (Clean/Dirty/Maintenance) & emit real-time event
roomRouter.patch('/:roomId/status', RoomController.updateRoomStatus);

// GET /api/rooms/categories - Fetch room categories
roomRouter.get('/categories', RoomController.getRoomCategories);

// POST /api/rooms/categories - Create a new room category dynamically
roomRouter.post('/categories', RoomController.createRoomCategory);

// DELETE /api/rooms/categories/:categoryId - Delete a room category by ID
roomRouter.delete('/categories/:categoryId', RoomController.deleteRoomCategory);

// POST /api/rooms - Create a new room on the fly
roomRouter.post('/', RoomController.createRoom);

// DELETE /api/rooms/:roomId - Delete a room by ID
roomRouter.delete('/:roomId', RoomController.deleteRoom);
