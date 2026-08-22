import { prisma } from '@hotel-pms/database';
import type { CreateReservationInput } from '@hotel-pms/types';
import { ChannelService } from './channel.service.js';
import { CalendarService } from './calendar.service.js';
import { WhatsAppService } from './whatsapp.service.js';
import { emitReservationCreated } from '../realtime/socket.js';

export class ReservationService {
  /**
   * Creates a reservation with a strict concurrency lock and date overlap validation.
   * Uses PostgreSQL row locking (FOR UPDATE) within a prisma.$transaction.
   */
  static async createReservationWithLock(input: CreateReservationInput & { propertyId?: string }) {
    const {
      guestId: providedGuestId,
      roomId,
      checkIn: checkInRaw,
      checkOut: checkOutRaw,
      checkInTime = '12:00 PM',
      checkOutTime = '11:00 AM',
      adults = 1,
      children = 0,
      advancePaid = 0,
      notes,
      status,
      propertyId,
    } = input;

    // Normalize guest details from either nested object or root properties
    const rawGuestName = input.guest?.name || (input as any).guestName;
    const rawGuestPhone = input.guest?.phone || (input as any).guestPhone;
    const guestInput = (rawGuestName || rawGuestPhone || !providedGuestId)
      ? {
          name: rawGuestName?.trim() || 'Walk-in Guest',
          phone: rawGuestPhone?.trim() || '+91 9823012345',
          email: input.guest?.email || (input as any).guestEmail || undefined,
          address: input.guest?.address || (input as any).address || undefined,
          pincode: input.guest?.pincode || (input as any).pincode || undefined,
          idNumber: input.guest?.idNumber || (input as any).idNumber || undefined,
          passportNumber: input.guest?.passportNumber || (input as any).passportNumber || undefined,
          dob: input.guest?.dob || (input as any).dateOfBirth || undefined,
          hostName: input.guest?.hostName || (input as any).hostName || undefined,
          hostPhone: input.guest?.hostPhone || undefined,
        }
      : undefined;

    if (!roomId || !checkInRaw || !checkOutRaw) {
      const error: any = new Error(
        'Missing required fields: roomId, checkIn, and checkOut are required'
      );
      error.statusCode = 400;
      throw error;
    }

    const totalAmount = input.totalAmount !== undefined ? Number(input.totalAmount) : 2500;

    const checkIn = new Date(checkInRaw);
    const checkOut = new Date(checkOutRaw);

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

    // Validate that checkIn is not in the past (allow today and future dates using ISO date string comparison)
    const checkInIsoDate = checkIn.toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayIsoDate = yesterday.toISOString().slice(0, 10);

    if (checkInIsoDate < yesterdayIsoDate) {
      const error: any = new Error(`Cannot book rooms for past dates (${checkInIsoDate})`);
      error.statusCode = 400;
      throw error;
    }

    if (totalAmount < 0) {
      const error: any = new Error('totalAmount cannot be negative');
      error.statusCode = 400;
      throw error;
    }

    // Execute atomic transaction with pessimistic locking
    const createdReservation = await prisma.$transaction(async (tx) => {
      // 1. Acquire an exclusive row-level lock on the Room to serialize concurrent bookings for this room
      const lockedRooms: any[] = await tx.$queryRaw`
        SELECT id FROM "Rooms" WHERE id = ${roomId} FOR UPDATE
      `;

      if (!lockedRooms || lockedRooms.length === 0) {
        const error: any = new Error(`Room with ID ${roomId} not found`);
        error.statusCode = 404;
        throw error;
      }

      // If tenant propertyId provided, verify room belongs to tenant
      if (propertyId) {
        const roomCheck = await tx.rooms.findUnique({
          where: { id: roomId },
          include: { roomCategory: true },
        });
        if (roomCheck && roomCheck.roomCategory.propertyId !== propertyId) {
          const error: any = new Error('Access forbidden: Cannot book a room belonging to another property');
          error.statusCode = 403;
          throw error;
        }
      }

      // 2. Query for overlapping active reservations
      // Overlap condition: existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn
      const overlappingReservation = await tx.reservations.findFirst({
        where: {
          roomId,
          status: { not: 'Cancelled' },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
        include: {
          guest: true,
          room: true,
        },
      });

      if (overlappingReservation) {
        const guestName = overlappingReservation.guest?.name || 'Another Guest';
        const roomNum = overlappingReservation.room?.roomNumber || 'this room';
        const inDate = overlappingReservation.checkIn.toISOString().slice(0, 10);
        const outDate = overlappingReservation.checkOut.toISOString().slice(0, 10);
        const error: any = new Error(
          `Room ${roomNum} is already booked from ${inDate} to ${outDate} by ${guestName}. Overlapping bookings are blocked.`
        );
        error.statusCode = 409;
        throw error;
      }

      // 3. Resolve Guest record
      let targetGuestId = providedGuestId;

      if (!targetGuestId && guestInput) {
        const email = guestInput.email || `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}@hotelpms.local`;
        const phone = guestInput.phone || '+91 9823012345';
        const name = guestInput.name || 'Walk-in Guest';

        let guest = await tx.guests.findUnique({
          where: { email },
        });

        if (!guest) {
          guest = await tx.guests.create({
            data: {
              name,
              email,
              phone,
              address: guestInput.address || null,
              pincode: guestInput.pincode || null,
              idNumber: guestInput.idNumber || null,
              passportNumber: guestInput.passportNumber || null,
              dob: guestInput.dob ? new Date(guestInput.dob) : null,
              hostName: guestInput.hostName || null,
              hostPhone: guestInput.hostPhone || null,
            },
          });
        }
        targetGuestId = guest.id;
      }

      if (!targetGuestId) {
        const guest = await tx.guests.create({
          data: {
            name: 'Walk-in Guest',
            email: `walkin_${Date.now()}_${Math.floor(Math.random() * 1000)}@hotelpms.local`,
            phone: '+91 9823012345',
          },
        });
        targetGuestId = guest.id;
      }

      // 4. Create the Reservation atomically
      const reservation = await tx.reservations.create({
        data: {
          roomId,
          guestId: targetGuestId,
          checkIn,
          checkOut,
          checkInTime,
          checkOutTime,
          adults: Number(adults),
          children: Number(children),
          totalAmount: Number(totalAmount),
          advancePaid: Number(advancePaid),
          notes: notes || null,
          status: status || 'Confirmed',
        },
        include: {
          guest: true,
          room: {
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
          },
        },
      });

      return reservation;
    });

    // 5. Trigger Outbound ARI Sync to connected OTAs
    ChannelService.pushARIUpdate({
      roomId: createdReservation.roomId,
      roomNumber: createdReservation.room.roomNumber,
      propertyId: createdReservation.room.roomCategory?.propertyId,
      eventType: 'ReservationCreated',
      newStatus: createdReservation.status,
      availabilityChanged: true,
      details: `New reservation confirmed for Room ${createdReservation.room.roomNumber} (${checkIn.toISOString().slice(0, 10)} to ${checkOut.toISOString().slice(0, 10)})`,
    });

    // 6. Broadcast Real-Time Reservation Event to Mobile/Web PMS Dashboards
    try {
      emitReservationCreated(createdReservation);
    } catch (e: any) {
      console.warn(`⚠️ [WebSocket Emit] reservationCreated emit error: ${e.message}`);
    }

    // 7. Push Reservation Event to Management Google Calendar Dashboard (Non-blocking)
    let calendarLink = '';
    try {
      const calRes = await CalendarService.syncReservationToCalendar(
        createdReservation,
        createdReservation.room,
        createdReservation.guest
      );
      if (calRes && calRes.htmlLink) {
        calendarLink = calRes.htmlLink;
      }
    } catch (calErr: any) {
      console.warn(`⚠️ [Google Calendar Sync Error] Non-blocking calendar push failed: ${calErr.message}`);
    }

    // 8. Send WhatsApp Confirmation Message (Non-blocking)
    if (createdReservation.guest?.phone) {
      const total = Number(createdReservation.totalAmount);
      const advance = Number(createdReservation.advancePaid || 0);
      const pending = total - advance;
      const currency = createdReservation.room.roomCategory?.property?.currency || 'INR';

      WhatsAppService.sendBookingConfirmation({
        guestName: createdReservation.guest.name,
        guestPhone: createdReservation.guest.phone,
        propertyName: createdReservation.room.roomCategory?.property?.name || 'Hotel Property',
        roomNumber: createdReservation.room.roomNumber,
        checkIn: createdReservation.checkIn.toISOString().slice(0, 10),
        checkOut: createdReservation.checkOut.toISOString().slice(0, 10),
        totalAmount: total,
        advancePaid: advance,
        pendingAmount: pending,
        currency,
        bookingRef: createdReservation.id,
        calendarLink: calendarLink || undefined,
      }).catch((waErr: any) => {
        console.warn(`⚠️ [WhatsApp Confirmation Error] Failed to send message: ${waErr.message}`);
      });
    }

    return Object.assign(createdReservation, { calendarLink });
  }

  /**
   * Fetch all reservations with full relation graphs, filtered by property
   */
  static async getAllReservations(propertyId?: string) {
    return await prisma.reservations.findMany({
      where: propertyId ? {
        room: {
          roomCategory: {
            propertyId,
          },
        },
      } : undefined,
      include: {
        guest: true,
        room: {
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
        },
        invoices: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * GET /api/bookings Endpoint Service:
   * Retrieves data filtered by startDate and endDate overlap query, mapped to exact UI format
   */
  static async getBookings(startDate?: string, endDate?: string, propertyId?: string) {
    let checkInCondition: any = undefined;
    let checkOutCondition: any = undefined;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        // Date Overlap condition: checkIn < endDate AND checkOut > startDate
        checkInCondition = { lt: end };
        checkOutCondition = { gt: start };
      }
    }

    const reservations = await prisma.reservations.findMany({
      where: {
        ...(propertyId ? { room: { roomCategory: { propertyId } } } : {}),
        ...(checkInCondition && checkOutCondition
          ? {
              checkIn: checkInCondition,
              checkOut: checkOutCondition,
            }
          : {}),
      },
      include: {
        guest: true,
        room: {
          include: {
            roomCategory: true,
          },
        },
      },
      orderBy: {
        checkIn: 'asc',
      },
    });

    return reservations.map((res) => {
      const total = Number(res.totalAmount || 0);
      const advance = Number(res.advancePaid || 0);
      const balance = Math.max(0, total - advance);

      const categoryName = res.room?.roomCategory?.name || 'Standard';
      const roomNum = res.room?.roomNumber || 'Room';
      const roomNameAndPlan = `${categoryName} ${roomNum} EP`;

      // Generate a clean numeric booking ID from UUID
      const hexPart = res.id.replace(/-/g, '').slice(-4);
      const numericId = (parseInt(hexPart, 16) % 9000) + 1000;
      const bookingId = `#${numericId}`;

      const formatShortDate = (d: Date) => {
        return d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      };

      const formatTimestamp = (d: Date) => {
        return d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      };

      return {
        id: res.id,
        roomId: res.roomId,
        checkIn: res.checkIn.toISOString(),
        checkOut: res.checkOut.toISOString(),
        room: res.room,
        guest: res.guest,
        bookingId,
        roomNameAndPlan,
        guestName: res.guest?.name || 'Walk-in Guest',
        guestPhone: res.guest?.phone || '+91 9823012345',
        lastUpdatedBy: 'Front Desk',
        lastUpdatedTimestamp: formatTimestamp(res.updatedAt || res.createdAt),
        counts: {
          rooms: 1,
          children: res.children || 0,
          adults: res.adults || 1,
        },
        dates: {
          checkIn: formatShortDate(res.checkIn),
          checkOut: formatShortDate(res.checkOut),
          rawCheckIn: res.checkIn.toISOString().slice(0, 10),
          rawCheckOut: res.checkOut.toISOString().slice(0, 10),
        },
        financials: {
          totalAmount: total,
          advancePaid: advance,
          balanceAmount: balance,
        },
        status: res.status,
      };
    });
  }

  /**
   * Helper method to trigger WhatsApp notification via WhatsAppService
   */
  static async sendWhatsAppNotification(payload: any) {
    return await WhatsAppService.sendBookingConfirmation(payload);
  }
}
