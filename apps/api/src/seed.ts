import { prisma } from '@hotel-pms/database';
import { RoomStatus, ReservationStatus } from '@hotel-pms/types';
import bcrypt from 'bcryptjs';

/**
 * Pune In-House Property & Demo User Seeder
 *
 * Seeds "The Royal Maratha Resort" (Koregaon Park, Pune) with room categories,
 * rooms (101-303), guests, initial bookings across December 2026, and default demo user.
 */
async function main() {
  console.log('===============================================================');
  console.log('🏨 [PUNE PMS SEED] Seeding The Royal Maratha Resort & SaaS User');
  console.log('===============================================================');

  try {
    // 1. Create or fetch Chain
    let chain = await prisma.chains.findFirst({
      where: { name: 'Maratha Heritage Hospitality Pvt Ltd' },
    });
    if (!chain) {
      chain = await prisma.chains.create({
        data: {
          name: 'Maratha Heritage Hospitality Pvt Ltd',
        },
      });
    }

    // 2. Create or fetch Property
    let property = await prisma.properties.findFirst({
      where: { name: 'The Royal Maratha Resort & Convention Centre' },
    });
    if (!property) {
      property = await prisma.properties.create({
        data: {
          name: 'The Royal Maratha Resort & Convention Centre',
          address: 'Lane 7, Koregaon Park, North Main Road',
          city: 'Pune',
          country: 'India',
          currency: 'INR',
          zipCode: '411001',
          chainId: chain.id,
        },
      });
    }

    // 3. Create or fetch Demo User
    const demoEmail = 'demo@simplybooking.com';
    let demoUser = await prisma.users.findUnique({
      where: { email: demoEmail },
    });

    if (!demoUser) {
      const passwordHash = await bcrypt.hash('password123', 10);
      demoUser = await prisma.users.create({
        data: {
          name: 'Adwait Kamble',
          email: demoEmail,
          passwordHash,
          mobileNumber: '+91 9823011223',
          propertyId: property.id,
        },
      });
      console.log(`👤 Demo User Created: ${demoEmail} (Password: password123)`);
    }

    // 4. Room Categories
    const categoriesData = [
      {
        name: 'Deluxe Heritage Room',
        description: 'Spacious king bedroom with traditional teak furnishings & garden view',
        basePrice: 2800.0,
      },
      {
        name: 'Executive Garden Suite',
        description: 'Luxury suite with private lounge, balcony overlooking pool & breakfast',
        basePrice: 4500.0,
      },
      {
        name: 'Royal Maratha Penthouse',
        description: 'Top-tier luxury presidential penthouse with panoramic Sahyadri views',
        basePrice: 8500.0,
      },
    ];

    const categoryMap: Record<string, string> = {};
    for (const cat of categoriesData) {
      let existingCat = await prisma.roomCategories.findFirst({
        where: { name: cat.name, propertyId: property.id },
      });
      if (!existingCat) {
        existingCat = await prisma.roomCategories.create({
          data: {
            name: cat.name,
            description: cat.description,
            basePrice: cat.basePrice,
            propertyId: property.id,
          },
        });
      }
      categoryMap[cat.name] = existingCat.id;
    }

    // 5. Rooms Definition
    const roomsToSeed = [
      { roomNumber: '101', catName: 'Deluxe Heritage Room', status: RoomStatus.Clean, pricePerNight: 2800, roomSize: '250 sq ft' },
      { roomNumber: '102', catName: 'Deluxe Heritage Room', status: RoomStatus.Clean, pricePerNight: 3100, roomSize: '280 sq ft (Corner)' },
      { roomNumber: '103', catName: 'Deluxe Heritage Room', status: RoomStatus.Dirty, pricePerNight: 2800, roomSize: '250 sq ft' },
      { roomNumber: '201', catName: 'Executive Garden Suite', status: RoomStatus.Clean, pricePerNight: 4500, roomSize: '400 sq ft' },
      { roomNumber: '202', catName: 'Executive Garden Suite', status: RoomStatus.Clean, pricePerNight: 4900, roomSize: '450 sq ft (Pool View)' },
      { roomNumber: '203', catName: 'Executive Garden Suite', status: RoomStatus.Maintenance, pricePerNight: 4500, roomSize: '400 sq ft' },
      { roomNumber: '301', catName: 'Royal Maratha Penthouse', status: RoomStatus.Clean, pricePerNight: 8500, roomSize: '750 sq ft' },
      { roomNumber: '302', catName: 'Royal Maratha Penthouse', status: RoomStatus.Clean, pricePerNight: 9500, roomSize: '850 sq ft (Jacuzzi)' },
      { roomNumber: '303', catName: 'Royal Maratha Penthouse', status: RoomStatus.Clean, pricePerNight: 8500, roomSize: '750 sq ft' },
    ];

    const roomMap: Record<string, string> = {};
    for (const r of roomsToSeed) {
      let existingRoom = await prisma.rooms.findFirst({
        where: { roomNumber: r.roomNumber, roomCategoryId: categoryMap[r.catName] },
      });
      if (!existingRoom) {
        existingRoom = await prisma.rooms.create({
          data: {
            roomNumber: r.roomNumber,
            pricePerNight: r.pricePerNight,
            roomSize: r.roomSize,
            status: r.status,
            roomCategoryId: categoryMap[r.catName],
          },
        });
      }
      roomMap[r.roomNumber] = existingRoom.id;
    }

    // 6. Seed Guests
    const guestsData = [
      {
        name: 'Adwait Kamble',
        email: 'adwait.kamble@example.in',
        phone: '+91 9823011223',
        address: 'Baner, Pune',
        pincode: '411045',
        idNumber: 'AADH-8821-4412',
      },
      {
        name: 'Shubham Mama',
        email: 'shubham.mama@example.in',
        phone: '+91 9922334455',
        address: 'Kalyani Nagar, Pune',
        pincode: '411006',
        idNumber: 'AADH-5521-9988',
      },
      {
        name: 'Pooja Deshmukh',
        email: 'pooja.d@example.in',
        phone: '+91 9881122334',
        address: 'Shivaji Nagar, Pune',
        pincode: '411005',
        idNumber: 'AADH-3344-5566',
      },
      {
        name: 'Vikram Joshi',
        email: 'vikram.j@example.in',
        phone: '+91 9765432100',
        address: 'Viman Nagar, Pune',
        pincode: '411014',
        idNumber: 'AADH-7788-9900',
      },
    ];

    const guestMap: Record<string, string> = {};
    for (const g of guestsData) {
      let existingGuest = await prisma.guests.findFirst({
        where: { phone: g.phone },
      });
      if (!existingGuest) {
        existingGuest = await prisma.guests.create({
          data: g,
        });
      }
      guestMap[g.name] = existingGuest.id;
    }

    // 7. Seed Reservations for 2D Gantt Calendar
    const reservationsData = [
      {
        guestName: 'Adwait Kamble',
        roomNumber: '101',
        checkIn: new Date('2026-12-01T14:00:00.000Z'),
        checkOut: new Date('2026-12-04T10:00:00.000Z'),
        adults: 2,
        children: 0,
        totalAmount: 8400.0,
        advancePaid: 3000.0,
        notes: 'VIP Guest • Pune Tech Conference 2026',
        status: ReservationStatus.Confirmed,
      },
      {
        guestName: 'Shubham Mama',
        roomNumber: '201',
        checkIn: new Date('2026-12-02T14:00:00.000Z'),
        checkOut: new Date('2026-12-06T10:00:00.000Z'),
        adults: 2,
        children: 1,
        totalAmount: 18000.0,
        advancePaid: 5000.0,
        notes: 'Family vacation • Requested garden side facing pool',
        status: ReservationStatus.Confirmed,
      },
      {
        guestName: 'Pooja Deshmukh',
        roomNumber: '301',
        checkIn: new Date('2026-12-05T14:00:00.000Z'),
        checkOut: new Date('2026-12-09T10:00:00.000Z'),
        adults: 2,
        children: 0,
        totalAmount: 34000.0,
        advancePaid: 10000.0,
        notes: 'Anniversary celebration • Complimentary cake arranged',
        status: ReservationStatus.Confirmed,
      },
      {
        guestName: 'Vikram Joshi',
        roomNumber: '102',
        checkIn: new Date('2026-12-07T14:00:00.000Z'),
        checkOut: new Date('2026-12-10T10:00:00.000Z'),
        adults: 1,
        children: 0,
        totalAmount: 8400.0,
        advancePaid: 2000.0,
        notes: 'Late check-in at 8 PM',
        status: ReservationStatus.Confirmed,
      },
    ];

    for (const res of reservationsData) {
      const existingRes = await prisma.reservations.findFirst({
        where: {
          roomId: roomMap[res.roomNumber],
          checkIn: res.checkIn,
        },
      });

      if (!existingRes) {
        await prisma.reservations.create({
          data: {
            guestId: guestMap[res.guestName],
            roomId: roomMap[res.roomNumber],
            checkIn: res.checkIn,
            checkOut: res.checkOut,
            adults: res.adults,
            children: res.children,
            totalAmount: res.totalAmount,
            advancePaid: res.advancePaid,
            notes: res.notes,
            status: res.status,
          },
        });
      }
    }

    console.log('✅ Pune Property, SaaS User & 2D Gantt reservations seeded successfully!');
    console.log(`   Property ID: ${property.id}`);
    console.log(`   Demo User: ${demoEmail} / password123`);
  } catch (error) {
    console.error('❌ [SEED ERROR]:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
