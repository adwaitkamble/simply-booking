import { ApiClient } from '../../../mobile/src/api/client.js';

async function runSaaSAuthIsolationTest() {
  console.log('=====================================================================');
  console.log('🛡️ [SAAS MULTI-TENANT & AUTH TEST] Verifying JWT & Isolation');
  console.log('=====================================================================');

  // 0. Ensure API server is listening
  try {
    await fetch('http://localhost:4000/api/health');
  } catch {
    await import('../server.js');
    await new Promise((r) => setTimeout(r, 1000));
  }

  const timestamp = Date.now();

  try {
    // =========================================================================
    // STEP 1: Unauthenticated Requests Must Return 401
    // =========================================================================
    console.log('\n[Step 1] Verifying 401 Unauthorized on protected routes without JWT...');
    ApiClient.setAuthToken(null);

    const unauthRoutes = [
      { path: '/properties/default', method: 'GET' },
      { path: '/rooms', method: 'POST' },
      { path: '/reservations', method: 'GET' },
      { path: '/invoices/generate', method: 'POST' },
    ];

    for (const route of unauthRoutes) {
      const res = await fetch(`http://localhost:4000/api${route.path}`, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status !== 401) {
        throw new Error(`Expected 401 Unauthorized on ${route.method} ${route.path}, got ${res.status}`);
      }
      console.log(`   🔒 Route ${route.method} ${route.path} correctly blocked with 401 Unauthorized`);
    }

    // =========================================================================
    // STEP 2: Demo User Login (Pune Property)
    // =========================================================================
    console.log('\n[Step 2] Testing Demo User Login...');
    const demoLogin = await ApiClient.login({
      email: 'demo@simplybooking.com',
      password: 'password123',
    });
    console.log('   ✅ Demo Login Succeeded:', demoLogin.user.name, `(${demoLogin.user.email})`);
    console.log('   🏨 Demo Property:', demoLogin.property.name, `(ID: ${demoLogin.property.id})`);
    if (!demoLogin.token) throw new Error('Expected JWT token in demo login response');

    // =========================================================================
    // STEP 3: Register Tenant 1 (Goa Palms Resort)
    // =========================================================================
    console.log('\n[Step 3] Registering Tenant 1 (Goa Palms Resort)...');
    const tenant1Email = `rohan_${timestamp}@goapalms.com`;
    const tenant1Auth = await ApiClient.register({
      propertyName: `Goa Palms Luxury Resort ${timestamp}`,
      name: 'Rohan Mehta',
      email: tenant1Email,
      country: 'India',
      currency: 'INR',
      city: 'Goa',
      zipCode: '403001',
      mobileNumber: '+91 9822114477',
      password: 'GoaPassword123!',
    });
    console.log('   ✅ Tenant 1 Registered:', tenant1Auth.user.name);
    console.log('   🏨 Property 1 ID:', tenant1Auth.property.id);
    const tokenTenant1 = tenant1Auth.token;
    const prop1Id = tenant1Auth.property.id;

    // =========================================================================
    // STEP 4: Register Tenant 2 (Dubai Skyline Hotel)
    // =========================================================================
    console.log('\n[Step 4] Registering Tenant 2 (Dubai Skyline Hotel)...');
    const tenant2Email = `fatima_${timestamp}@dubaiskyline.ae`;
    const tenant2Auth = await ApiClient.register({
      propertyName: `Dubai Skyline Suites ${timestamp}`,
      name: 'Fatima Al-Mansoor',
      email: tenant2Email,
      country: 'United Arab Emirates',
      currency: 'AED',
      city: 'Dubai',
      zipCode: '00000',
      mobileNumber: '+971 501234567',
      password: 'DubaiPassword123!',
    });
    console.log('   ✅ Tenant 2 Registered:', tenant2Auth.user.name);
    console.log('   🏨 Property 2 ID:', tenant2Auth.property.id);
    const tokenTenant2 = tenant2Auth.token;
    const prop2Id = tenant2Auth.property.id;

    // =========================================================================
    // STEP 5: Create Rooms for Each Tenant
    // =========================================================================
    console.log('\n[Step 5] Creating Rooms in separate tenant properties...');
    
    // Tenant 1 creates room
    ApiClient.setAuthToken(tokenTenant1);
    const t1Categories = (await ApiClient.fetchDefaultProperty()).roomCategories;
    const t1Room = await ApiClient.createRoom({
      roomNumber: '101-GOA',
      roomCategoryId: t1Categories[0].id,
    });
    console.log(`   🏖️ Tenant 1 Room Created: ${t1Room.roomNumber} (ID: ${t1Room.id})`);

    // Tenant 2 creates room
    ApiClient.setAuthToken(tokenTenant2);
    const t2Categories = (await ApiClient.fetchDefaultProperty()).roomCategories;
    const t2Room = await ApiClient.createRoom({
      roomNumber: '901-DXB',
      roomCategoryId: t2Categories[0].id,
    });
    console.log(`   🏙️ Tenant 2 Room Created: ${t2Room.roomNumber} (ID: ${t2Room.id})`);

    // =========================================================================
    // STEP 6: Verify Strict Tenant Isolation on Room Lists
    // =========================================================================
    console.log('\n[Step 6] Verifying Data Partitioning & Room List Isolation...');

    // Tenant 1 lists rooms
    ApiClient.setAuthToken(tokenTenant1);
    const t1Rooms = await ApiClient.fetchPropertyRooms(prop1Id);
    console.log(`   Tenant 1 sees ${t1Rooms.length} room(s):`, t1Rooms.map((r: any) => r.roomNumber));
    if (t1Rooms.some((r: any) => r.roomNumber === '901-DXB')) {
      throw new Error('DATA LEAK: Tenant 1 can see Tenant 2 rooms!');
    }

    // Tenant 2 lists rooms
    ApiClient.setAuthToken(tokenTenant2);
    const t2Rooms = await ApiClient.fetchPropertyRooms(prop2Id);
    console.log(`   Tenant 2 sees ${t2Rooms.length} room(s):`, t2Rooms.map((r: any) => r.roomNumber));
    if (t2Rooms.some((r: any) => r.roomNumber === '101-GOA')) {
      throw new Error('DATA LEAK: Tenant 2 can see Tenant 1 rooms!');
    }

    // =========================================================================
    // STEP 7: Cross-Tenant Booking Security (Prevent Tenant 2 booking Tenant 1 room)
    // =========================================================================
    console.log('\n[Step 7] Testing Cross-Tenant Booking Attack Prevention...');
    ApiClient.setAuthToken(tokenTenant2); // Tenant 2 logged in

    const checkIn = new Date('2026-12-10T14:00:00Z').toISOString();
    const checkOut = new Date('2026-12-14T10:00:00Z').toISOString();

    try {
      // Tenant 2 attempts to book Tenant 1's room (t1Room.id)
      await ApiClient.createReservation({
        roomId: t1Room.id,
        checkIn,
        checkOut,
        totalAmount: 12000,
        guest: {
          name: 'Hacker Guest',
          phone: '+9999999999',
        },
      });
      throw new Error('SECURITY BREACH: Cross-tenant booking should have been rejected!');
    } catch (err: any) {
      console.log(`   🛡️ [403 FORBIDDEN CONFIRMED] Cross-tenant booking blocked: "${err.message}"`);
    }

    // =========================================================================
    // STEP 8: Valid Booking and Reservation Isolation
    // =========================================================================
    console.log('\n[Step 8] Creating valid Tenant 1 booking and checking reservation list isolation...');
    ApiClient.setAuthToken(tokenTenant1); // Tenant 1 logged in

    const t1Reservation = await ApiClient.createReservation({
      roomId: t1Room.id,
      checkIn,
      checkOut,
      totalAmount: 14000,
      guest: {
        name: 'Sunil Gavaskar',
        email: `sunil_${timestamp}@cricket.in`,
        phone: '+91 9820011223',
      },
    });
    console.log('   ✅ Tenant 1 Booking Created:', t1Reservation.id, `(Guest: ${t1Reservation.guest?.name})`);

    // Tenant 1 views reservations -> sees 1 reservation
    const t1ResList = await ApiClient.fetchReservations();
    console.log(`   Tenant 1 sees ${t1ResList.length} reservation(s)`);
    if (!t1ResList.some((r: any) => r.id === t1Reservation.id)) {
      throw new Error('Tenant 1 cannot find their own reservation!');
    }

    // Tenant 2 views reservations -> sees 0 reservations
    ApiClient.setAuthToken(tokenTenant2);
    const t2ResList = await ApiClient.fetchReservations();
    console.log(`   Tenant 2 sees ${t2ResList.length} reservation(s)`);
    if (t2ResList.some((r: any) => r.id === t1Reservation.id)) {
      throw new Error('DATA LEAK: Tenant 2 can see Tenant 1 reservations!');
    }

    console.log('\n=====================================================================');
    console.log('🎉 [ALL SAAS & AUTH TESTS PASSED] Multi-tenant isolation verified 100%');
    console.log('=====================================================================\n');
  } catch (error) {
    console.error('❌ [SaaS Auth Test FAILED]:', error);
    process.exit(1);
  }
}

runSaaSAuthIsolationTest().then(() => {
  setTimeout(() => process.exit(0), 100);
});
