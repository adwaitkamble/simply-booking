import { prisma } from '@hotel-pms/database';
import type {
  OTAInboundWebhookPayload,
  OTAWebhookResponse,
  CreateReservationInput,
} from '@hotel-pms/types';
import { ReservationService } from './reservation.service.js';
import { ChannelService } from './channel.service.js';

export class OTAAdapterService {
  /**
   * Process and normalize an incoming OTA webhook booking payload
   */
  static async processInboundBooking(
    payload: OTAInboundWebhookPayload
  ): Promise<OTAWebhookResponse> {
    const { channel, otaReservationId, guest, roomId, checkIn, checkOut, totalAmount } = payload;

    if (!channel || !otaReservationId || !guest || !roomId || !checkIn || !checkOut) {
      const error: any = new Error(
        'Malformed OTA payload: channel, otaReservationId, guest, roomId, checkIn, and checkOut are required'
      );
      error.statusCode = 400;
      ChannelService.recordInboundLog({
        channel: channel || 'Unknown',
        eventType: 'InboundBookingFailed',
        status: 'ERROR',
        details: 'Malformed OTA webhook payload rejected',
      });
      throw error;
    }

    // 1. Find or create the external guest in PostgreSQL
    const guestRecord = await prisma.guests.upsert({
      where: { email: guest.email },
      update: {
        name: guest.name,
        phone: guest.phone,
      },
      create: {
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
      },
    });

    // 2. Map OTA payload to internal CreateReservationInput
    const reservationInput: CreateReservationInput = {
      guestId: guestRecord.id,
      roomId,
      checkIn,
      checkOut,
      totalAmount: Number(totalAmount),
      status: 'Confirmed',
    };

    // 3. Route directly into ReservationService to execute the exact same pessimistic lock
    try {
      const reservation = await ReservationService.createReservationWithLock(reservationInput);

      // Record successful inbound event
      ChannelService.recordInboundLog({
        channel,
        eventType: 'InboundBookingConfirmed',
        status: 'SUCCESS',
        details: `[${channel}] Ref #${otaReservationId} -> Room ${(reservation as any).room?.roomNumber || roomId} Confirmed ($${totalAmount})`,
      });

      return {
        success: true,
        reservationId: reservation.id,
        otaReservationId,
        channel,
        status: reservation.status,
        message: `Reservation confirmed for ${guest.name} via ${channel}`,
      };
    } catch (err: any) {
      // Record failed/rejected inbound event
      ChannelService.recordInboundLog({
        channel,
        eventType: 'InboundBookingRejected',
        status: err.statusCode === 409 ? 'CONFLICT_409' : 'ERROR',
        details: `[${channel}] Ref #${otaReservationId} Rejected: ${err.message}`,
      });
      throw err;
    }
  }
}
