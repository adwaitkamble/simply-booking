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
      include: {
        roomCategories: {
          include: {
            rooms: true,
          },
        },
      },
    });

    if (!property) {
      const error: any = new Error(`Property with ID ${propertyId} not found`);
      error.statusCode = 404;
      throw error;
    }

    // Auto-seed rooms if property has 0 rooms
    const totalRooms = property.roomCategories.reduce((acc, cat) => acc + (cat.rooms?.length || 0), 0);
    if (totalRooms === 0) {
      if (property.roomCategories.length === 0) {
        const categoriesData = [
          { name: 'Deluxe Heritage Room', description: 'Spacious king bedroom with garden view', basePrice: 2800.0, rooms: ['101', '102', '103'] },
          { name: 'Executive Garden Suite', description: 'Luxury suite with balcony overlooking pool', basePrice: 4500.0, rooms: ['201', '202', '203'] },
          { name: 'Royal Penthouse', description: 'Top-tier luxury penthouse with scenic views', basePrice: 8500.0, rooms: ['301', '302', '303'] },
        ];
        for (const cat of categoriesData) {
          const createdCat = await prisma.roomCategories.create({
            data: {
              name: cat.name,
              description: cat.description,
              basePrice: cat.basePrice,
              propertyId: property.id,
            },
          });
          for (const rNum of cat.rooms) {
            await prisma.rooms.create({
              data: {
                roomNumber: rNum,
                pricePerNight: cat.basePrice,
                status: 'Clean',
                roomCategoryId: createdCat.id,
              },
            });
          }
        }
      } else {
        for (let i = 0; i < property.roomCategories.length; i++) {
          const cat = property.roomCategories[i];
          const floor = i + 1;
          for (const rNum of [`${floor}01`, `${floor}02`, `${floor}03`]) {
            await prisma.rooms.create({
              data: {
                roomNumber: rNum,
                pricePerNight: cat.basePrice,
                status: 'Clean',
                roomCategoryId: cat.id,
              },
            });
          }
        }
      }
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
    pricePerNight?: number;
    roomSize?: string;
    roomCategoryId?: string;
    status?: RoomStatus;
    propertyId?: string;
  }) {
    const { roomNumber, pricePerNight, roomSize, status = 'Clean', propertyId } = data;
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
        pricePerNight: pricePerNight !== undefined && pricePerNight !== null ? Number(pricePerNight) : null,
        roomSize: roomSize?.trim() || null,
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

  /**
   * Create a new room category dynamically for a property
   */
  static async createRoomCategory(data: {
    name: string;
    description?: string;
    basePrice: number;
    propertyId: string;
  }) {
    const { name, description, basePrice, propertyId } = data;

    if (!name || !name.trim()) {
      const error: any = new Error('Missing required field: name is required');
      error.statusCode = 400;
      throw error;
    }

    const priceNum = Number(basePrice);
    if (basePrice === undefined || basePrice === null || isNaN(priceNum) || priceNum < 0) {
      const error: any = new Error('Invalid basePrice: basePrice must be a positive number');
      error.statusCode = 400;
      throw error;
    }

    const property = await prisma.properties.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      const error: any = new Error(`Property with ID ${propertyId} not found`);
      error.statusCode = 404;
      throw error;
    }

    const existing = await prisma.roomCategories.findFirst({
      where: {
        propertyId,
        name: { equals: name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      const error: any = new Error(`Room category "${name.trim()}" already exists for this property`);
      error.statusCode = 409;
      throw error;
    }

    const newCategory = await prisma.roomCategories.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        basePrice: priceNum,
        propertyId,
      },
    });

    return newCategory;
  }

  /**
   * Fetch all room categories for a property
   */
  static async getRoomCategories(propertyId: string) {
    const categories = await prisma.roomCategories.findMany({
      where: { propertyId },
      include: {
        rooms: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return categories;
  }

  /**
   * Delete a room by ID with reservation safety checks
   */
  static async deleteRoom(roomId: string, propertyId?: string) {
    const room = await prisma.rooms.findUnique({
      where: { id: roomId },
      include: {
        roomCategory: true,
        reservations: {
          where: {
            status: { not: 'Cancelled' },
            checkOut: { gte: new Date() },
          },
        },
      },
    });

    if (!room) {
      const error: any = new Error(`Room with ID ${roomId} not found`);
      error.statusCode = 404;
      throw error;
    }

    if (propertyId && room.roomCategory?.propertyId !== propertyId) {
      const error: any = new Error('Access forbidden: You cannot delete rooms outside your property.');
      error.statusCode = 403;
      throw error;
    }

    if (room.reservations.length > 0) {
      const error: any = new Error(
        `Cannot remove Room #${room.roomNumber} because it currently has active or upcoming guest reservations. Please cancel or reassign those reservations first.`
      );
      error.statusCode = 400;
      throw error;
    }

    try {
      // Delete status logs, linked reservations, and room in an atomic transaction
      await prisma.$transaction(async (tx) => {
        // Delete linked reservations history for this room to avoid foreign key restrict errors
        await tx.reservations.deleteMany({
          where: { roomId },
        });
        await tx.roomStatusLogs.deleteMany({
          where: { roomId },
        });
        await tx.rooms.delete({
          where: { id: roomId },
        });
      });
    } catch (dbErr: any) {
      if (dbErr.code === 'P2003' || dbErr.message?.includes('23001') || dbErr.message?.includes('foreign key constraint')) {
        const error: any = new Error(
          `Cannot remove Room #${room.roomNumber} because active reservations are linked to it in PostgreSQL.`
        );
        error.statusCode = 400;
        throw error;
      }
      throw dbErr;
    }

    // Notify connected clients of room status/matrix change
    emitRoomStatusUpdated({
      roomId,
      roomNumber: room.roomNumber,
      previousStatus: room.status as RoomStatus,
      newStatus: room.status as RoomStatus,
      changedAt: new Date().toISOString(),
      turnoverDurationSeconds: null,
      staffId: null,
    });

    return { deleted: true, roomNumber: room.roomNumber };
  }

  /**
   * Delete a room category by ID with safe room reassignment
   */
  static async deleteRoomCategory(categoryId: string, propertyId?: string) {
    const category = await prisma.roomCategories.findUnique({
      where: { id: categoryId },
      include: {
        rooms: true,
      },
    });

    if (!category) {
      const error: any = new Error(`Room category with ID ${categoryId} not found`);
      error.statusCode = 404;
      throw error;
    }

    if (propertyId && category.propertyId !== propertyId) {
      const error: any = new Error('Access forbidden: You cannot delete categories outside your property.');
      error.statusCode = 403;
      throw error;
    }

    // Find fallback category for property
    const fallbackCategory = await prisma.roomCategories.findFirst({
      where: {
        propertyId: category.propertyId,
        id: { not: categoryId },
      },
      orderBy: { createdAt: 'asc' },
    });

    await prisma.$transaction(async (tx) => {
      if (category.rooms.length > 0) {
        if (fallbackCategory) {
          // Reassign rooms to alternative category
          await tx.rooms.updateMany({
            where: { roomCategoryId: categoryId },
            data: { roomCategoryId: fallbackCategory.id },
          });
        } else {
          // No fallback category exists, delete rooms
          for (const rm of category.rooms) {
            await tx.roomStatusLogs.deleteMany({ where: { roomId: rm.id } });
            await tx.rooms.delete({ where: { id: rm.id } });
          }
        }
      }

      await tx.roomCategories.delete({
        where: { id: categoryId },
      });
    });

    return { deleted: true, categoryName: category.name };
  }

  /**
   * Fetch rooms inventory with stats and room cards mapping
   */
  static async getRoomsInventory(propertyId?: string) {
    const now = new Date();

    // Auto-ensure rooms exist if propertyId given
    if (propertyId) {
      await RoomService.getRoomsByProperty(propertyId);
    }

    const rooms = await prisma.rooms.findMany({
      where: propertyId
        ? {
            roomCategory: {
              propertyId,
            },
          }
        : undefined,
      include: {
        roomCategory: true,
        reservations: {
          where: {
            status: { not: 'Cancelled' },
            checkIn: { lte: now },
            checkOut: { gte: now },
          },
        },
      },
      orderBy: {
        roomNumber: 'asc',
      },
    });

    const roomImages = [
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=500&auto=format&fit=crop&q=60',
    ];

    let usedCount = 0;

    const mappedRooms = rooms.map((rm, idx) => {
      const activeRes = rm.reservations[0];
      const isOccupied = !!activeRes;
      if (isOccupied) usedCount++;

      const statusStr = isOccupied
        ? 'Occupied'
        : rm.status === 'Clean'
        ? 'Active'
        : rm.status;

      return {
        id: rm.id,
        roomId: rm.id,
        roomNumber: rm.roomNumber,
        roomCategoryId: rm.roomCategoryId,
        pricePerNight: rm.pricePerNight ?? rm.roomCategory?.basePrice ?? 2500,
        imageUrl: roomImages[idx % roomImages.length],
        categoryName: rm.roomCategory?.name || 'Standard',
        roomName: `Room ${rm.roomNumber}`,
        status: statusStr,
        childCount: activeRes?.children ?? 0,
        adultCount: activeRes?.adults ?? 2,
      };
    });

    return {
      stats: {
        total: rooms.length,
        used: usedCount,
      },
      rooms: mappedRooms,
    };
  }
}
