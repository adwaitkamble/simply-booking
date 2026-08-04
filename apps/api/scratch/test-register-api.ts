import { ApiClient } from '../../mobile/src/api/client';
import { prisma } from '@hotel-pms/database';

async function main() {
  const timestamp = Date.now();
  const email = `test_${timestamp}@example.com`;
  
  console.log(`Sending registration request for ${email}...`);
  const res = await ApiClient.register({
    propertyName: `Test Property ${timestamp}`,
    name: 'Test Owner',
    email,
    country: 'India',
    currency: 'INR',
    city: 'Pune',
    password: 'password123',
  });
  
  console.log('API Response:', res);
  
  // Verify database record
  const dbUser = await prisma.users.findUnique({
    where: { email },
    include: { property: true }
  });
  
  if (dbUser) {
    console.log('✅ User successfully saved in database:', dbUser.email);
    console.log('🏨 Property name:', dbUser.property.name);
  } else {
    console.error('❌ User not found in database!');
  }
}

main().catch(console.error);
