import { prisma } from '@hotel-pms/database';

async function main() {
  console.log('🔄 Enforcing single primary Admin policy in PostgreSQL database...');

  // 1. Ensure adwaitakamble007@gmail.com is Admin
  const primaryAdmin = await prisma.users.findUnique({
    where: { email: 'adwaitakamble007@gmail.com' },
  });

  if (primaryAdmin) {
    await prisma.users.update({
      where: { id: primaryAdmin.id },
      data: {
        role: 'Admin',
        isActive: true,
      },
    });
    console.log(`✅ Set primary Admin: ${primaryAdmin.name} (${primaryAdmin.email})`);
  } else {
    console.warn('⚠️ User adwaitakamble007@gmail.com not found in database.');
  }

  // 2. Convert all other users to Staff role
  const updatedStaff = await prisma.users.updateMany({
    where: {
      email: { not: 'adwaitakamble007@gmail.com' },
    },
    data: {
      role: 'Staff',
    },
  });

  console.log(`✅ Converted ${updatedStaff.count} non-primary users to Staff role.`);

  // 3. Print all current users and their assigned roles
  const allUsers = await prisma.users.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  console.log('📋 [Updated Database User Roster]:');
  console.table(allUsers);
}

main()
  .catch((e) => {
    console.error('❌ Failed to enforce single admin script:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
