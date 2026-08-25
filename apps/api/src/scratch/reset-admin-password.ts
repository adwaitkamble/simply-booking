import { prisma } from '@hotel-pms/database';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'adwaitakamble007@gmail.com';
  const plainPassword = 'Sondev@1234';

  console.log(`🔄 Resetting password for ${email}...`);

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

  // Check if user exists
  const existingUser = await prisma.users.findUnique({
    where: { email },
    include: { property: true },
  });

  if (existingUser) {
    const updated = await prisma.users.update({
      where: { id: existingUser.id },
      data: {
        passwordHash,
        role: 'Admin',
        isActive: true,
      },
    });
    console.log(`✅ Updated existing Admin account: ${updated.name} (${updated.email})`);
    console.log(`   Property ID: ${updated.propertyId}`);
  } else {
    // Get default property
    const property = await prisma.properties.findFirst();
    if (!property) {
      throw new Error('No property found in database to link admin user.');
    }

    const newUser = await prisma.users.create({
      data: {
        name: 'Adwait Kamble',
        email,
        passwordHash,
        role: 'Admin',
        isActive: true,
        propertyId: property.id,
      },
    });
    console.log(`✅ Created new Admin account: ${newUser.name} (${newUser.email})`);
  }

  // Verify bcrypt password matching
  const checkUser = await prisma.users.findUnique({ where: { email } });
  if (checkUser) {
    const isMatch = await bcrypt.compare(plainPassword, checkUser.passwordHash);
    console.log(`🔑 Password Verification Check for "${plainPassword}": ${isMatch ? 'PASSED ✅' : 'FAILED ❌'}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Reset password failed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
