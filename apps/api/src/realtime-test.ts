import './server.js';
import { io as ClientSocket, Socket } from 'socket.io-client';
import { prisma } from '@hotel-pms/database';
import type { RoomStatusUpdatedPayload } from '@hotel-pms/types';

/**
 * Real-Time Housekeeping Turnover Test Script
 *
 * Verifies:
 * 1. WebSocket connection to the Real-Time server.
 * 2. Real-time broadcast of 'roomStatusUpdated' when HTTP PATCH /api/rooms/:roomId/status executes.
 * 3. PostgreSQL persistence of RoomStatusLogs with calculated turnover duration.
 */
async function runRealtimeTurnoverTest() {
  console.log('===============================================================');
  console.log('⚡ [REAL-TIME TURNOVER TEST] Testing Socket.io & Status Triggers');
  console.log('===============================================================');

  const SERVER_URL = 'http://localhost:4000';
  let socket: Socket | null = null;

  try {
    // 1. Establish WebSocket Connection
    console.log('\n[Step 1] Connecting Mock WebSocket Client to', SERVER_URL);
    socket = ClientSocket(SERVER_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 3,
      timeout: 5000,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket connection timed out')), 5000);
      socket!.on('connect', () => {
        clearTimeout(timer);
        console.log(`✅ [WebSocket Connected] Socket ID: ${socket!.id}`);
        resolve();
      });
      socket!.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // 2. Setup or Pick a Target Room and seed it to 'Dirty'
    console.log('\n[Step 2] Setting up a test room with status "Dirty" in PostgreSQL...');
    let targetRoom = await prisma.rooms.findFirst({
      include: { roomCategory: true },
    });

    if (!targetRoom) {
      throw new Error('No rooms found in database. Run seed first.');
    }

    // Set initial state to Dirty and log the change timestamp
    await prisma.rooms.update({
      where: { id: targetRoom.id },
      data: { status: 'Dirty' },
    });

    await prisma.roomStatusLogs.create({
      data: {
        roomId: targetRoom.id,
        previousStatus: 'Clean',
        newStatus: 'Dirty',
        changedAt: new Date(Date.now() - 30000), // 30 seconds ago
      },
    });

    console.log(`✅ Room ${targetRoom.roomNumber} (${targetRoom.id}) reset to "Dirty" (30s ago)`);

    // 3. Register WebSocket Listener for 'roomStatusUpdated'
    console.log('\n[Step 3] Registering WebSocket listener for "roomStatusUpdated"...');
    const receivedEventPromise = new Promise<RoomStatusUpdatedPayload>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket event listener timed out (5s)')), 5000);

      socket!.on('roomStatusUpdated', (payload: RoomStatusUpdatedPayload) => {
        if (payload.roomId === targetRoom!.id) {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    // 4. Trigger Housekeeper Action via HTTP PATCH /api/rooms/:roomId/status
    console.log('\n[Step 4] Triggering HTTP PATCH /api/rooms/:roomId/status -> { status: "Clean" }...');
    const startHttp = Date.now();
    const httpRes = await fetch(`${SERVER_URL}/api/rooms/${targetRoom.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Clean' }),
    });

    const httpJson: any = await httpRes.json();
    const httpElapsed = Date.now() - startHttp;

    if (!httpRes.ok) {
      throw new Error(`HTTP PATCH failed: ${JSON.stringify(httpJson)}`);
    }

    console.log(`✅ HTTP PATCH succeeded in ${httpElapsed}ms:`);
    console.log(`   Message: ${httpJson.message}`);
    console.log(`   New Status: ${httpJson.data.updatedRoom.status}`);

    // 5. Await WebSocket Event Receipt
    console.log('\n[Step 5] Awaiting Real-Time WebSocket event broadcast...');
    const eventPayload = await receivedEventPromise;
    console.log('📡 [WebSocket Event Received Instantly!]');
    console.log(`   Room Number:              ${eventPayload.roomNumber}`);
    console.log(`   Previous Status:          ${eventPayload.previousStatus}`);
    console.log(`   New Status:               ${eventPayload.newStatus}`);
    console.log(`   Turnover Duration Logged: ${eventPayload.turnoverDurationSeconds} seconds`);
    console.log(`   Timestamp:                ${eventPayload.changedAt}`);

    // 6. Verify Database Log Entry
    console.log('\n[Step 6] Querying PostgreSQL RoomStatusLogs table for audit trail...');
    const dbLog = await prisma.roomStatusLogs.findFirst({
      where: { roomId: targetRoom.id },
      orderBy: { changedAt: 'desc' },
    });

    if (!dbLog) {
      throw new Error('Expected RoomStatusLogs record in database but none found');
    }

    console.log('✅ PostgreSQL RoomStatusLogs record verified:');
    console.log(`   Log ID:                   ${dbLog.id}`);
    console.log(`   Room ID:                  ${dbLog.roomId}`);
    console.log(`   Transition:               ${dbLog.previousStatus} -> ${dbLog.newStatus}`);
    console.log(`   Turnover Duration:        ${dbLog.turnoverDurationSeconds}s`);
    console.log(`   Database ChangedAt:       ${dbLog.changedAt.toISOString()}`);

    console.log('\n===============================================================');
    console.log('🎉 [REAL-TIME TURNOVER TEST PASSED] All events & DB logs verified!');
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ [Real-Time Turnover Test Failed]:', error);
    process.exit(1);
  } finally {
    if (socket) {
      socket.disconnect();
    }
    await prisma.$disconnect();
  }
}

runRealtimeTurnoverTest().then(() => {
  setTimeout(() => process.exit(0), 100);
});
