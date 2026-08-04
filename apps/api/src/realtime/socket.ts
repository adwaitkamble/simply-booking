import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { RoomStatusUpdatedPayload, ARIUpdatePayload, ChannelSyncLogDTO } from '@hotel-pms/types';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.io attached to the Node HTTP server
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`⚡ [WebSocket] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 [WebSocket] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

/**
 * Broadcast room status updates to all connected frontends/dashboards
 */
export function emitRoomStatusUpdated(payload: RoomStatusUpdatedPayload): void {
  if (!io) {
    console.warn('⚠️ [WebSocket] emitRoomStatusUpdated called before Socket.io initialization');
    return;
  }

  console.log(
    `📡 [WebSocket Broadcast] roomStatusUpdated -> Room ${payload.roomNumber} (${payload.previousStatus} -> ${payload.newStatus})`
  );
  io.emit('roomStatusUpdated', payload);
}

/**
 * Broadcast outbound ARI sync updates
 */
export function emitARIUpdated(payload: ARIUpdatePayload): void {
  if (!io) {
    return;
  }

  console.log(
    `📡 [WebSocket Broadcast] ariUpdated -> Room ${payload.roomNumber} [${payload.eventType}]`
  );
  io.emit('ariUpdated', payload);
}

/**
 * Broadcast channel sync log updates to CRS dashboard
 */
export function emitChannelLogAdded(payload: ChannelSyncLogDTO): void {
  if (!io) {
    return;
  }

  io.emit('channelLogAdded', payload);
}

/**
 * Broadcast new reservation created to calendar matrix and front desk
 */
export function emitReservationCreated(payload: any): void {
  if (!io) {
    return;
  }

  console.log(
    `📡 [WebSocket Broadcast] reservationCreated -> Res #${payload.id} (Guest: ${payload.guest?.name || 'Guest'})`
  );
  io.emit('reservationCreated', payload);
}

/**
 * Broadcast reservation updated / cancelled to front desk
 */
export function emitReservationUpdated(payload: any): void {
  if (!io) {
    return;
  }

  io.emit('reservationUpdated', payload);
}

export function getIO(): SocketIOServer | null {
  return io;
}


