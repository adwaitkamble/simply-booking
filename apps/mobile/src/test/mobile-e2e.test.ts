import { ApiClient, ApiError } from '../api/client.js';
import type { RoomStatus, ReservationStatus } from '@hotel-pms/types';

/**
 * Mobile App End-to-End Client Test
 *
 * Verifies that the mobile frontend client can authenticate with JWT,
 * communicate with the live Express backend, query available inventory,
 * submit a reservation, and cleanly handle 409 concurrency conflicts.
 */
async function runMobileE2ETest() {
  console.log('===============================================================');
  console.log('📱 [MOBILE E2E INTEGRATION TEST] Testing Mobile Client & API');
  console.log('===============================================================');

  // Check if API server is already running, otherwise boot it
  try {
    await fetch('http://localhost:4000/api/health');
  } catch {
    await import('../../../api/src/server.js');
    await new Promise((r) => setTimeout(r, 1000));
  }

  const timestamp = Date.now();

  try {
    // 0. Authenticate Mobile Client
    console.log('\n[Step 0] Logging in via Mobile Auth Client...');
    const authResult = await ApiClient.login({
      email: 'demo@simplybooking.com',
      password: 'password123',
    });
    console.log(`✅ Mobile Auth Succeeded for: ${authResult.user.name}`);
    console.log(`   Property: ${authResult.property.name} (${authResult.property.currency})`);

    // 1. Fetch available rooms
    console.log('\n[Step 1] Querying available inventory via Mobile API Client...');
    const offsetDays = (timestamp % 300) + 30;
    const checkInDate = new Date(Date.now() + offsetDays * 86400000);
    const checkOutDate = new Date(Date.now() + (offsetDays + 3) * 86400000);
    const checkIn = checkInDate.toISOString();
    const checkOut = checkOutDate.toISOString();

    const availableRooms = await ApiClient.fetchAvailableRooms(checkIn, checkOut);
    console.log(`✅ Available Rooms Retrieved: ${availableRooms.length}`);

    if (availableRooms.length === 0) {
      throw new Error('Expected at least 1 room in database to test mobile booking flow');
    }

    const targetRoom = availableRooms[0];
    console.log(`   Selected Room: ${targetRoom.roomNumber} (${targetRoom.id})`);
    console.log(`   Category:      ${targetRoom.roomCategory?.name} (₹${targetRoom.roomCategory?.basePrice}/night)`);
    console.log(`   Property:      ${targetRoom.roomCategory?.property?.name}`);

    // 2. Fetch an existing guest from past reservations to use as test guest
    const existingReservations = await ApiClient.fetchReservations();
    const guestId = existingReservations[0]?.guestId || existingReservations[0]?.guest?.id;

    if (!guestId) {
      throw new Error('No test guest found in existing reservations');
    }

    console.log(`\n[Step 2] Formulating Mobile Booking for Guest: ${guestId}`);
    const bookingPayload = {
      guestId,
      roomId: targetRoom.id,
      checkIn,
      checkOut,
      totalAmount: (targetRoom.roomCategory?.basePrice || 4500) * 5,
      status: 'Confirmed' as ReservationStatus,
    };

    // 3. Submit Booking
    console.log('\n[Step 3] Submitting reservation POST /api/reservations...');
    const bookingResult = await ApiClient.createReservation(bookingPayload);
    console.log('🟢 [201 CREATED] Reservation confirmed successfully!');
    console.log(`   Reservation ID: ${bookingResult.id}`);
    console.log(`   Total Amount:   ₹${bookingResult.totalAmount}`);
    console.log(`   Guest Name:     ${bookingResult.guest?.name}`);

    // 4. Test Concurrency 409 Conflict Handling on Mobile Client
    console.log('\n[Step 4] Testing duplicate booking collision on Mobile Client...');
    try {
      await ApiClient.createReservation(bookingPayload);
      throw new Error('Expected duplicate booking to fail with 409 Conflict');
    } catch (err: any) {
      if (err instanceof ApiError && err.statusCode === 409) {
        console.log('🔴 [409 CONFLICT HANDLED] Mobile client caught expected concurrency error:');
        console.log(`   Error Message: "${err.message}"`);
        console.log(`   Status Code:   ${err.statusCode}`);
      } else {
        throw err;
      }
    }

    console.log('\n===============================================================');
    console.log('🎉 [MOBILE E2E TEST PASSED] Full stack mobile-to-API flow verified!');
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ [Mobile E2E Test Failed]:', error);
    process.exit(1);
  }
}

runMobileE2ETest().then(() => {
  setTimeout(() => process.exit(0), 100);
});
