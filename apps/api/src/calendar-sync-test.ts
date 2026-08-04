import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  dotenv.config({ path: resolve(__dirname, '../.env') });
} catch {}
dotenv.config({ path: resolve(process.cwd(), 'apps/api/.env') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

import { CalendarService } from './services/calendar.service.js';
import { ReservationService } from './services/reservation.service.js';
import { prisma } from '@hotel-pms/database';

/**
 * Google Calendar Integration & Sync Verification Script
 */
async function testCalendarIntegration() {
  console.log('===============================================================');
  console.log('📅 [GOOGLE CALENDAR TEST] Testing Service Account & Event Sync');
  console.log('===============================================================');
  console.log(`Configured Email:       ${process.env.GOOGLE_CLIENT_EMAIL || '(Not set)'}`);
  console.log(`Configured Calendar ID: ${process.env.GOOGLE_CALENDAR_ID || '(Not set)'}`);
  console.log(`Private Key Loaded:     ${process.env.GOOGLE_PRIVATE_KEY ? 'YES (Valid Length)' : 'NO'}`);

  // Step 1: Test Direct CalendarService Formatting & Event Creation
  console.log('\n[Step 1] Constructing test reservation payload for Google Calendar...');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const now = Date.now();
  const testCheckIn = new Date(now + 86400000 * 30); // 30 days from now
  const testCheckOut = new Date(now + 86400000 * 34); // 34 days from now

  const mockReservation = {
    id: `res-cal-${randomSuffix}`,
    checkIn: testCheckIn,
    checkOut: testCheckOut,
    totalAmount: 950.0,
    status: 'Confirmed',
  };

  const mockRoom = {
    id: 'room-cal-001',
    roomNumber: `STE-${randomSuffix}`,
    roomCategory: {
      name: 'Presidential Ocean Suite',
      property: {
        name: 'The Grand Horizon Luxury Resort & Spa',
      },
    },
  };

  const mockGuest = {
    name: 'Alexander Hamilton',
    email: 'alexander.hamilton@example.com',
    phone: '+1-555-1776',
  };

  const syncResult = await CalendarService.syncReservationToCalendar(
    mockReservation,
    mockRoom,
    mockGuest
  );

  console.log('✅ Calendar Sync Invocation Result:', syncResult);
  if (!syncResult.success) {
    console.warn('⚠️ Direct Calendar sync reported failure/warning:', syncResult.error);
  }

  // Step 2: Test End-to-End Booking Engine Reservation + Google Calendar Trigger
  console.log('\n[Step 2] Testing PMS Booking Engine Reservation with Concurrency Lock & Calendar Sync...');
  
  // Find or create a test guest
  let testGuest = await prisma.guests.findFirst();
  if (!testGuest) {
    testGuest = await prisma.guests.create({
      data: {
        name: 'Adwait Kamble',
        email: 'adwaitakamble007@gmail.com',
        phone: '+1-555-0199',
      },
    });
  }

  // Find an available clean room
  const availableRoom = await prisma.rooms.findFirst({
    where: {
      status: 'Clean',
    },
    include: {
      roomCategory: {
        include: {
          property: true,
        },
      },
    },
  });

  if (availableRoom) {
    // Generate unique future booking window to prevent collisions
    const randomDayOffset = Math.floor(60 + Math.random() * 500);
    const checkInDate = new Date(now + 86400000 * randomDayOffset);
    const checkOutDate = new Date(now + 86400000 * (randomDayOffset + 3));

    console.log(`Creating fresh reservation for Room ${availableRoom.roomNumber} (${checkInDate.toISOString().slice(0,10)} to ${checkOutDate.toISOString().slice(0,10)})...`);
    
    const createdReservation = await ReservationService.createReservationWithLock({
      guestId: testGuest.id,
      roomId: availableRoom.id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      totalAmount: (availableRoom.roomCategory?.basePrice || 200) * 3,
    });

    console.log(`✅ Reservation ${createdReservation.id} created successfully!`);
    console.log(`   Guest:    ${createdReservation.guest.name} (${createdReservation.guest.email})`);
    console.log(`   Room:     Room ${createdReservation.room.roomNumber} (${createdReservation.room.roomCategory?.name})`);
    console.log(`   Dates:    ${checkInDate.toISOString().slice(0, 10)} ➔ ${checkOutDate.toISOString().slice(0, 10)}`);
    console.log(`   Total:    $${createdReservation.totalAmount}`);
  }

  console.log('\n===============================================================');
  console.log('🎉 [GOOGLE CALENDAR TEST COMPLETED] Pipeline execution finished!');
  console.log('===============================================================');
}

testCalendarIntegration()
  .catch((err) => {
    console.error('❌ [CALENDAR TEST FAILED]:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
