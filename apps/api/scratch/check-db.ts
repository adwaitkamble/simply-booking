import { prisma } from '@hotel-pms/database';

async function main() {
  const users = await prisma.users.findMany({
    include: { property: true }
  });
  console.log('--- USERS IN DB ---');
  console.log(JSON.stringify(users, null, 2));

  const properties = await prisma.properties.findMany();
  console.log('--- PROPERTIES IN DB ---');
  console.log(JSON.stringify(properties, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
