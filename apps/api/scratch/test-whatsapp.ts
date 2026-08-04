import { ApiClient } from '../../mobile/src/api/client';
import { prisma } from '@hotel-pms/database';

async function main() {
  const timestamp = Date.now();
  
  // 1. Get Pune Property
  const property = await prisma.properties.findFirst({
    where: { name: 'The Royal Maratha Resort & Convention Centre' }
  });
  
  if (!property) {
    console.error('Pune property not found in DB!');
    return;
  }
  
  // 2. Fetch a room in Pune Property
  const room = await prisma.rooms.findFirst({
    where: {
      roomCategory: {
        propertyId: property.id
      }
    }
  });
  
  if (!room) {
    console.error('No rooms found for Pune property!');
    return;
  }
  
  // 3. Login as Demo User to get token
  const auth = await ApiClient.login({
    email: 'demo@simplybooking.com',
    password: 'password123'
  });
  
  ApiClient.setAuthToken(auth.token);
  
  console.log(`Creating test reservation on Room ${room.roomNumber}...`);
  
  // 4. Create reservation
  const res = await ApiClient.createReservation({
    roomId: room.id,
    guest: {
      name: 'Sachin Tendulkar',
      email: `sachin_${timestamp}@example.com`,
      phone: '+91 9999988888', // This number will receive the notification
    },
    checkIn: '2026-12-25',
    checkOut: '2026-12-28',
    adults: 2,
    children: 0,
    totalAmount: 7500,
    advancePaid: 1500,
    notes: 'Please keep the room clean. Master blaster booking.',
    status: 'Confirmed',
  });
  
  console.log('Reservation Response:', res);
  console.log('✅ Concurrency / Reservation creation call finished successfully!');
}

main().catch(console.error);
