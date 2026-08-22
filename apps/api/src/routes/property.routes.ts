import { Router } from 'express';
import { PropertyController } from '../controllers/property.controller.js';
import { RoomController } from '../controllers/room.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

export const propertyRouter = Router();

// Protect all property routes
propertyRouter.use(authenticateUser);

// GET /api/properties/default
propertyRouter.get('/default', PropertyController.getDefaultProperty);

// GET /api/properties
propertyRouter.get('/', PropertyController.getAllProperties);

// GET /api/properties/:propertyId
propertyRouter.get('/:propertyId', PropertyController.getPropertyById);

// GET /api/properties/:propertyId/rooms
propertyRouter.get('/:propertyId/rooms', RoomController.getPropertyRooms);

// DELETE /api/properties/:propertyId/rooms/:roomId
propertyRouter.delete('/:propertyId/rooms/:roomId', RoomController.deleteRoom);
