import { prisma } from '@hotel-pms/database';
import type {
  ARIUpdatePayload,
  ChannelSyncLogDTO,
  ChannelDistributionMetricsDTO,
  OTAChannel,
} from '@hotel-pms/types';
import { emitARIUpdated, emitChannelLogAdded } from '../realtime/socket.js';
import { randomUUID } from 'node:crypto';

export const CONNECTED_CHANNELS: OTAChannel[] = [
  'Expedia',
  'Booking.com',
  'Airbnb',
  'Agoda',
];

// In-memory ring buffer for CRS audit and activity feed (capped at 100 entries)
const syncLogs: ChannelSyncLogDTO[] = [];
const MAX_LOGS = 100;

export class ChannelService {
  /**
   * Pushes outbound ARI (Availability, Rates, Inventory) update to all connected OTAs
   */
  static pushARIUpdate(params: {
    roomId: string;
    roomNumber: string;
    propertyId?: string;
    eventType: 'ReservationCreated' | 'ReservationCancelled' | 'RoomStatusChanged';
    newStatus: string;
    availabilityChanged: boolean;
    details?: string;
  }): ARIUpdatePayload {
    const timestamp = new Date().toISOString();
    const channels = [...CONNECTED_CHANNELS];

    const ariPayload: ARIUpdatePayload = {
      roomId: params.roomId,
      roomNumber: params.roomNumber,
      propertyId: params.propertyId,
      eventType: params.eventType,
      newStatus: params.newStatus,
      availabilityChanged: params.availabilityChanged,
      timestamp,
      channelsNotified: channels,
      details: params.details,
    };

    // Simulated Outbound HTTP push to OTAs
    console.log(
      `📡 [OUTBOUND ARI SYNC] Pushed inventory & rate update to [${channels.join(
        ', '
      )}] for Room ${params.roomNumber} (Event: ${params.eventType})`
    );

    // Record in CRS activity log
    const logEntry: ChannelSyncLogDTO = {
      id: randomUUID(),
      direction: 'OUTBOUND',
      channel: channels.join(','),
      eventType: params.eventType,
      status: 'SUCCESS',
      details: params.details || `ARI availability sync for Room ${params.roomNumber} (${params.newStatus})`,
      timestamp,
    };

    ChannelService.addSyncLog(logEntry);

    // Broadcast over Socket.io
    emitARIUpdated(ariPayload);

    return ariPayload;
  }

  /**
   * Record an inbound webhook synchronization event
   */
  static recordInboundLog(params: {
    channel: string;
    eventType: string;
    status: 'SUCCESS' | 'CONFLICT_409' | 'ERROR';
    details: string;
  }): ChannelSyncLogDTO {
    const logEntry: ChannelSyncLogDTO = {
      id: randomUUID(),
      direction: 'INBOUND',
      channel: params.channel,
      eventType: params.eventType,
      status: params.status,
      details: params.details,
      timestamp: new Date().toISOString(),
    };

    ChannelService.addSyncLog(logEntry);
    return logEntry;
  }

  /**
   * Internal helper to insert log and broadcast
   */
  private static addSyncLog(log: ChannelSyncLogDTO): void {
    syncLogs.unshift(log);
    if (syncLogs.length > MAX_LOGS) {
      syncLogs.pop();
    }
    emitChannelLogAdded(log);
  }

  /**
   * Fetch recent sync logs
   */
  static getSyncLogs(limit: number = 30): ChannelSyncLogDTO[] {
    return syncLogs.slice(0, limit);
  }

  /**
   * Clear sync logs (useful for test resets)
   */
  static clearLogs(): void {
    syncLogs.length = 0;
  }

  /**
   * Calculate Channel distribution metrics: Direct vs. OTA bookings & revenue
   */
  static async getChannelMetrics(): Promise<ChannelDistributionMetricsDTO> {
    const reservations = await prisma.reservations.findMany({
      include: {
        guest: true,
      },
    });

    let directBookings = 0;
    let otaBookings = 0;
    let directRevenue = 0;
    let otaRevenue = 0;

    const channelBreakdown: Record<string, { count: number; revenue: number }> = {
      Direct: { count: 0, revenue: 0 },
      Expedia: { count: 0, revenue: 0 },
      'Booking.com': { count: 0, revenue: 0 },
      Airbnb: { count: 0, revenue: 0 },
      Agoda: { count: 0, revenue: 0 },
    };

    for (const r of reservations) {
      const email = r.guest.email.toLowerCase();
      let assignedChannel = 'Direct';

      if (email.includes('expedia') || email.includes('exp-')) {
        assignedChannel = 'Expedia';
      } else if (email.includes('booking') || email.includes('bk-')) {
        assignedChannel = 'Booking.com';
      } else if (email.includes('airbnb') || email.includes('ab-')) {
        assignedChannel = 'Airbnb';
      } else if (email.includes('agoda') || email.includes('ag-')) {
        assignedChannel = 'Agoda';
      } else if (email.includes('ota') || email.includes('channel')) {
        assignedChannel = 'Expedia';
      }

      if (assignedChannel === 'Direct') {
        directBookings += 1;
        directRevenue += r.totalAmount;
      } else {
        otaBookings += 1;
        otaRevenue += r.totalAmount;
      }

      if (!channelBreakdown[assignedChannel]) {
        channelBreakdown[assignedChannel] = { count: 0, revenue: 0 };
      }
      channelBreakdown[assignedChannel].count += 1;
      channelBreakdown[assignedChannel].revenue += r.totalAmount;
    }

    const totalBookings = directBookings + otaBookings;
    const directPercentage = totalBookings > 0 ? Math.round((directBookings / totalBookings) * 100) : 100;
    const otaPercentage = totalBookings > 0 ? Math.round((otaBookings / totalBookings) * 100) : 0;
    const totalRevenue = directRevenue + otaRevenue;

    return {
      totalBookings,
      directBookings,
      otaBookings,
      directPercentage,
      otaPercentage,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      otaRevenue: Number(otaRevenue.toFixed(2)),
      directRevenue: Number(directRevenue.toFixed(2)),
      channelBreakdown,
    };
  }
}
