import { prisma } from '@hotel-pms/database';
import type { RoomStatus } from '@hotel-pms/types';
import { emitRoomStatusUpdated } from '../realtime/socket.js';
import { ChannelService } from './channel.service.js';

export class RoomService {
  /**
   * Fetch all rooms for a property, including category and current status
   */
  static async getRoomsByProperty(propertyId: string) {
    const property = await prisma.properties.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      const error: any = new Error(`Property with ID ${propertyId} not found`);
      error.statusCode = 404;
      throw error;
    }

    const rooms = await prisma.rooms.findMany({
      where: {
        roomCategory: {
          propertyId,
        },
      },
      include: {
        roomCategory: {
          select: {
            id: true,
            name: true,
            description: true,
            basePrice: true,
            propertyId: true,
          },
        },
      },
      orderBy: {
        roomNumber: 'asc',
      },
    });

    return rooms;
  }

  /**
   * Query only rooms that do NOT have overlapping active reservations for the requested dates
   */
  static async getAvailableRooms(
    checkInInput: string | Date,
    checkOutInput: string | Date,
    propertyId?: string
  ) {
    const checkIn = new Date(checkInInput);
    const checkOut = new Date(checkOutInput);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      const error: any = new Error('Invalid checkIn or checkOut date format');
      error.statusCode = 400;
      throw error;
    }

    if (checkOut <= checkIn) {
      const error: any = new Error('checkOut date must be strictly after checkIn date');
      error.statusCode = 400;
      throw error;
    }

    const availableRooms = await prisma.rooms.findMany({
      where: {
        ...(propertyId ? { roomCategory: { propertyId } } : {}),
        reservations: {
          none: {
            status: { not: 'Cancelled' },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        },
      },
      include: {
        roomCategory: {
          include: {
            property: {
              include: {
                chain: true,
              },
            },
          },
        },
      },
      orderBy: {
        roomNumber: 'asc',
      },
    });

    return availableRooms;
  }

  /**
   * Fetch rooms requiring housekeeping turnover (Dirty or Maintenance)
   */
  static async getHousekeepingRooms(propertyId?: string) {
    const rooms = await prisma.rooms.findMany({
      where: {
        status: { in: ['Dirty', 'Maintenance'] },
        ...(propertyId ? { roomCategory: { propertyId } } : {}),
      },
      include: {
        roomCategory: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                city: true,
              },
            },
          },
        },
        statusLogs: {
          orderBy: { changedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: {
        roomNumber: 'asc',
      },
    });

    return rooms;
  }

  /**
   * Update room status with ACID audit logging and real-time broadcast
   */
  static async updateRoomStatus(
    roomId: string,
    newStatus: RoomStatus,
    staffId?: string,
    propertyId?: string
  ) {
    // 1. Fetch current status & last log
    const room = await prisma.rooms.findUnique({
      where: { id: roomId },
      include: {
        roomCategory: true,
        statusLogs: {
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    if (!room) {
      const error: any = new Error(`Room with ID ${roomId} not found`);
      error.statusCode = 404;
      throw error;
    }

    if (propertyId && room.roomCategory?.propertyId !== propertyId) {
      const error: any = new Error('Access forbidden: You cannot update rooms outside your property.');
      error.statusCode = 403;
      throw error;
    }

    const previousStatus = room.status as RoomStatus;

    // Calculate turnover duration in seconds if turning from Dirty/Maintenance to Clean
    let turnoverDurationSeconds: number | null = null;
    if (newStatus === 'Clean' && room.statusLogs.length > 0) {
      const lastChange = new Date(room.statusLogs[0].changedAt).getTime();
      const now = Date.now();
      turnoverDurationSeconds = Math.max(0, Math.round((now - lastChange) / 1000));
    }

    // 2. Perform ACID transaction to update status & write log
    const result = await prisma.$transaction(async (tx) => {
      const updatedRoom = await tx.rooms.update({
        where: { id: roomId },
        data: { status: newStatus },
      });

      const statusLog = await tx.roomStatusLogs.create({
        data: {
          roomId,
          previousStatus,
          newStatus,
          staffId: staffId || null,
          turnoverDurationSeconds,
        },
      });

      return { updatedRoom, statusLog };
    });

    // 3. Emit real-time WebSocket event
    emitRoomStatusUpdated({
      roomId: result.updatedRoom.id,
      roomNumber: room.roomNumber,
      previousStatus,
      newStatus,
      changedAt: result.statusLog.changedAt.toISOString(),
      turnoverDurationSeconds: result.statusLog.turnoverDurationSeconds,
      staffId: result.statusLog.staffId,
    });

    // 4. Trigger Outbound ARI Sync to connected OTAs
    ChannelService.pushARIUpdate({
      roomId: result.updatedRoom.id,
      roomNumber: room.roomNumber,
      propertyId: room.roomCategory?.propertyId,
      eventType: 'RoomStatusChanged',
      newStatus,
      availabilityChanged: newStatus === 'Clean' || previousStatus === 'Clean',
      details: `Room ${room.roomNumber} status changed from ${previousStatus} to ${newStatus}`,
    });

    return result;
  }

  /**
   * Create a new room on the fly
   */
  static async createRoom(data: {
    roomNumber: string;
    roomCategoryId?: string;
    status?: RoomStatus;
    propertyId?: string;
  }) {
    const { roomNumber, status = 'Clean', propertyId } = data;
    let roomCategoryId = data.roomCategoryId;

    if (!roomNumber) {
      const error: any = new Error('Missing required field: roomNumber is required');
      error.statusCode = 400;
      throw error;
    }

    // If no roomCategoryId passed, find default category for this property
    if (!roomCategoryId && propertyId) {
      let defaultCategory = await prisma.roomCategories.findFirst({
        where: { propertyId },
      });

      if (!defaultCategory) {
        defaultCategory = await prisma.roomCategories.create({
          data: {
            name: 'Standard Room',
            basePrice: 2500,
            propertyId,
          },
        });
      }
      roomCategoryId = defaultCategory.id;
    }

    if (!roomCategoryId) {
      const error: any = new Error('Missing roomCategoryId');
      error.statusCode = 400;
      throw error;
    }

    const category = await prisma.roomCategories.findUnique({
      where: { id: roomCategoryId },
      include: { property: true },
    });

    if (!category) {
      const error: any = new Error(`Room Category with ID ${roomCategoryId} not found`);
      error.statusCode = 404;
      throw error;
    }

    if (propertyId && category.propertyId !== propertyId) {
      const error: any = new Error('Access forbidden: Cannot create room in a category from another property');
      error.statusCode = 403;
      throw error;
    }

    const existing = await prisma.rooms.findFirst({
      where: {
        roomCategoryId,
        roomNumber,
      },
    });

    if (existing) {
      const error: any = new Error(`Room ${roomNumber} already exists in this category`);
      error.statusCode = 409;
      throw error;
    }

    const newRoom = await prisma.rooms.create({
      data: {
        roomNumber,
        roomCategoryId,
        status: status as RoomStatus,
      },
      include: {
        roomCategory: {
          include: {
            property: true,
          },
        },
      },
    });

    // Create initial status log
    await prisma.roomStatusLogs.create({
      data: {
        roomId: newRoom.id,
        previousStatus: status as RoomStatus,
        newStatus: status as RoomStatus,
      },
    });

    // Emit real-time creation event
    emitRoomStatusUpdated({
      roomId: newRoom.id,
      roomNumber: newRoom.roomNumber,
      previousStatus: status as RoomStatus,
      newStatus: status as RoomStatus,
      changedAt: newRoom.createdAt.toISOString(),
      turnoverDurationSeconds: null,
      staffId: null,
    });

    return newRoom;
  }
}
