import { prisma } from '@hotel-pms/database';
import { ReservationService } from './services/reservation.service.js';
import { RoomStatus, ReservationStatus } from '@hotel-pms/types';

/**
 * Double-Booking Concurrency Stress Test
 *
 * Demonstrates and verifies that simultaneous booking requests for the exact same room
 * and overlapping dates are serialized and evaluated under atomic row-level locks,
 * guaranteeing zero double-bookings.
 */
async function runConcurrencyStressTest() {
  console.log('===============================================================');
  console.log('🔥 [CONCURRENCY STRESS TEST] Simulating Race Condition on Room');
  console.log('===============================================================');

  const timestamp = Date.now();

  try {
    // 1. Initialize Test Data
    console.log('\n[Step 1] Initializing isolated test hierarchy in PostgreSQL...');
    const chain = await prisma.chains.create({
      data: { name: `Stress Test Hospitality (${timestamp})` },
    });

    const property = await prisma.properties.create({
      data: {
        name: 'Concurrency Suites & Resort',
        address: '500 Race Condition Blvd',
        city: 'San Francisco',
        country: 'USA',
        chainId: chain.id,
      },
    });

    const roomCategory = await prisma.roomCategories.create({
      data: {
        name: 'Concurrency Penthouse',
        basePrice: 500.0,
        propertyId: property.id,
      },
    });

    const testRoom = await prisma.rooms.create({
      data: {
        roomNumber: `LOCK-${Math.floor(100 + Math.random() * 900)}`,
        status: RoomStatus.Clean,
        roomCategoryId: roomCategory.id,
      },
    });

    const guestA = await prisma.guests.create({
      data: {
        name: 'Alice Smith (User A)',
        email: `alice.${timestamp}@example.com`,
        phone: '+1-555-0101',
      },
    });

    const guestB = await prisma.guests.create({
      data: {
        name: 'Bob Jones (User B)',
        email: `bob.${timestamp}@example.com`,
        phone: '+1-555-0102',
      },
    });

    console.log(`✅ Test Room Created: [${testRoom.roomNumber}] (ID: ${testRoom.id})`);
    console.log(`✅ Test Guests Created: ${guestA.name} & ${guestB.name}`);

    // 2. Prepare Two Identical Overlapping Requests
    const checkIn = new Date('2026-11-01T14:00:00.000Z');
    const checkOut = new Date('2026-11-05T11:00:00.000Z');

    const bookingRequestA = {
      guestId: guestA.id,
      roomId: testRoom.id,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      totalAmount: 2000.0,
      status: ReservationStatus.Confirmed,
    };

    const bookingRequestB = {
      guestId: guestB.id,
      roomId: testRoom.id,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      totalAmount: 2000.0,
      status: ReservationStatus.Confirmed,
    };

    console.log('\n[Step 2] Constructing simultaneous booking requests for identical room and dates:');
    console.log(`   - Target Room: ${testRoom.roomNumber} (${testRoom.id})`);
    console.log(`   - Check-in:    ${checkIn.toISOString()}`);
    console.log(`   - Check-out:   ${checkOut.toISOString()}`);
    console.log('   - Request A:   Alice Smith');
    console.log('   - Request B:   Bob Jones');

    // 3. Fire Both Requests AT THE EXACT SAME TIME
    console.log('\n[Step 3] Firing Promise.allSettled([requestA, requestB]) concurrently...');
    const [resultA, resultB] = await Promise.allSettled([
      ReservationService.createReservationWithLock(bookingRequestA),
      ReservationService.createReservationWithLock(bookingRequestB),
    ]);

    // 4. Analyze Results
    console.log('\n[Step 4] Concurrency Resolution Analysis:');
    console.log('---------------------------------------------------------------');

    let successCount = 0;
    let failureCount = 0;
    let successfulReservation: any = null;
    let failedError: any = null;

    if (resultA.status === 'fulfilled') {
      successCount++;
      successfulReservation = resultA.value;
      console.log('🟢 Request A (Alice) Result: SUCCESS (201 Created)');
      console.log(`   Reservation ID: ${resultA.value.id}`);
      console.log(`   Guest: ${resultA.value.guest.name}`);
    } else {
      failureCount++;
      failedError = resultA.reason;
      console.log('🔴 Request A (Alice) Result: REJECTED (Concurrency Lock Held)');
      console.log(`   Error Message: "${resultA.reason?.message}" (Status Code: ${resultA.reason?.statusCode})`);
    }

    if (resultB.status === 'fulfilled') {
      successCount++;
      successfulReservation = resultB.value;
      console.log('🟢 Request B (Bob) Result: SUCCESS (201 Created)');
      console.log(`   Reservation ID: ${resultB.value.id}`);
      console.log(`   Guest: ${resultB.value.guest.name}`);
    } else {
      failureCount++;
      failedError = resultB.reason;
      console.log('🔴 Request B (Bob) Result: REJECTED (Concurrency Lock Held)');
      console.log(`   Error Message: "${resultB.reason?.message}" (Status Code: ${resultB.reason?.statusCode})`);
    }
    console.log('---------------------------------------------------------------');

    // 5. Assert Integrity
    const reservationsInDb = await prisma.reservations.findMany({
      where: {
        roomId: testRoom.id,
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });

    console.log(`\n[Step 5] Database Verification:`);
    console.log(`   Total reservations recorded in PostgreSQL for this slot: ${reservationsInDb.length}`);

    if (successCount === 1 && failureCount === 1 && reservationsInDb.length === 1) {
      console.log('\n🎉 [TEST PASSED] Concurrency lock functioned flawlessly!');
      console.log('   - Exactly 1 transaction acquired the row lock and committed.');
      console.log('   - Exactly 1 transaction was prevented from creating a double-booking.');
      console.log('   - Database referential and inventory integrity remains 100% ACID compliant.\n');
    } else {
      console.error('\n❌ [TEST FAILED] Double booking occurred or unexpected error distribution.');
      console.error(`   Success count: ${successCount}, Failure count: ${failureCount}, DB count: ${reservationsInDb.length}`);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ [Unexpected Test Error]:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runConcurrencyStressTest();
