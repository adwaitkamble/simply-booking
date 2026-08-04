import { prisma } from '@hotel-pms/database';
import { RoomStatus, ReservationStatus, StaffRole } from '@hotel-pms/types';

/**
 * Pune In-House Resort Database Seeder
 * Sets up "The Royal Maratha Heritage Resort & Spa, Pune" with realistic local inventory,
 * Indian rupee pricing, and local staff/guest profiles.
 */
async function seedPuneProperty() {
  console.log('================================================================');
  console.log('🇮🇳 [PUNE LOCALIZATION] Seeding In-House Pune Heritage Resort PMS');
  console.log('================================================================');

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Maratha Heritage Chain
      const chain = await tx.chains.create({
        data: {
          name: 'Maratha Heritage Hospitality Ltd.',
        },
      });

      // 2. Create In-House Pune Property
      const property = await tx.properties.create({
        data: {
          name: 'The Royal Maratha Heritage Resort & Spa',
          address: 'Plot 14, Lane 7, Koregaon Park',
          city: 'Pune',
          country: 'India',
          chainId: chain.id,
        },
      });

      // 3. Create Local Pune Room Categories with INR pricing
      const catClassic = await tx.roomCategories.create({
        data: {
          name: 'Classic Garden View Room',
          description: 'Spacious garden-facing room with rain shower, high-speed Wi-Fi & traditional decor',
          basePrice: 3500.0,
          propertyId: property.id,
        },
      });

      const catDeluxe = await tx.roomCategories.create({
        data: {
          name: 'Heritage Deluxe Room',
          description: 'Premium room with private balcony, pool view, work desk and complimentary breakfast',
          basePrice: 5200.0,
          propertyId: property.id,
        },
      });

      const catSuite = await tx.roomCategories.create({
        data: {
          name: 'Executive Club Suite',
          description: 'Luxurious 1-bedroom suite with living pavilion, espresso bar & club lounge access',
          basePrice: 8500.0,
          propertyId: property.id,
        },
      });

      const catVilla = await tx.roomCategories.create({
        data: {
          name: 'Presidential Maratha Villa',
          description: 'Grand royal villa with private plunge pool, private garden, jacuzzi & 24hr butler service',
          basePrice: 16500.0,
          propertyId: property.id,
        },
      });

      // 4. Create Rooms across floors
      const roomsData = [
        // Classic Rooms
        { roomNumber: '101', categoryId: catClassic.id, status: RoomStatus.Clean },
        { roomNumber: '102', categoryId: catClassic.id, status: RoomStatus.Clean },
        { roomNumber: '103', categoryId: catClassic.id, status: RoomStatus.Dirty },
        { roomNumber: '104', categoryId: catClassic.id, status: RoomStatus.Clean },

        // Deluxe Rooms
        { roomNumber: '201', categoryId: catDeluxe.id, status: RoomStatus.Clean },
        { roomNumber: '202', categoryId: catDeluxe.id, status: RoomStatus.Clean },
        { roomNumber: '203', categoryId: catDeluxe.id, status: RoomStatus.Clean },
        { roomNumber: '204', categoryId: catDeluxe.id, status: RoomStatus.Maintenance },

        // Executive Suites
        { roomNumber: '301', categoryId: catSuite.id, status: RoomStatus.Clean },
        { roomNumber: '302', categoryId: catSuite.id, status: RoomStatus.Clean },

        // Presidential Villas
        { roomNumber: 'VIL-01', categoryId: catVilla.id, status: RoomStatus.Clean },
        { roomNumber: 'VIL-02', categoryId: catVilla.id, status: RoomStatus.Clean },
      ];

      const createdRooms = [];
      for (const r of roomsData) {
        const room = await tx.rooms.create({
          data: {
            roomNumber: r.roomNumber,
            status: r.status,
            roomCategoryId: r.categoryId,
          },
        });
        createdRooms.push(room);
      }

      // 5. Create Indian Guest Profiles
      const guestsData = [
        { name: 'Rahul Sharma', email: 'rahul.sharma@example.in', phone: '+91 98230 11223' },
        { name: 'Priya Kulkarni', email: 'priya.kulkarni@example.in', phone: '+91 94220 55667' },
        { name: 'Aditya Patil', email: 'aditya.patil@example.in', phone: '+91 97654 88990' },
        { name: 'Ananya Joshi', email: 'ananya.joshi@example.in', phone: '+91 98901 33445' },
      ];

      const createdGuests = [];
      for (const g of guestsData) {
        // Upsert by email
        const guest = await tx.guests.upsert({
          where: { email: g.email },
          update: { name: g.name, phone: g.phone },
          create: g,
        });
        createdGuests.push(guest);
      }

      // 6. Create Staff Members
      const staffMembers = [
        { name: 'Suresh Shinde', email: 'suresh.shinde@royalmaratha.in', role: StaffRole.Housekeeper },
        { name: 'Pooja Deshmukh', email: 'pooja.deshmukh@royalmaratha.in', role: StaffRole.FrontDesk },
        { name: 'Rajesh Kadam', email: 'rajesh.kadam@royalmaratha.in', role: StaffRole.Manager },
      ];

      for (const s of staffMembers) {
        await tx.staff.upsert({
          where: { email: s.email },
          update: { name: s.name, role: s.role },
          create: s,
        });
      }

      // 7. Create an active demo reservation
      const checkIn = new Date();
      const checkOut = new Date(checkIn.getTime() + 3 * 24 * 60 * 60 * 1000);
      const demoRes = await tx.reservations.create({
        data: {
          guestId: createdGuests[0].id,
          roomId: createdRooms[0].id,
          checkIn,
          checkOut,
          totalAmount: 10500.0, // 3 nights @ ₹3,500
          status: ReservationStatus.Confirmed,
        },
      });

      return {
        property,
        roomsCount: createdRooms.length,
        guestsCount: createdGuests.length,
        demoResId: demoRes.id,
      };
    });

    console.log('✅ Pune Resort Hierarchy successfully initialized!');
    console.log(`   🏨 Property:   ${result.property.name}`);
    console.log(`   📍 Location:   ${result.property.address}, ${result.property.city}, ${result.property.country}`);
    console.log(`   🚪 Rooms:      ${result.roomsCount} rooms across 4 categories`);
    console.log(`   👤 Guests:     ${result.guestsCount} Indian guest profiles`);
    console.log(`   🔖 Demo Res:   ${result.demoResId}`);
    console.log('================================================================\n');
  } catch (error) {
    console.error('❌ [PUNE SEED FAILED]:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedPuneProperty();
