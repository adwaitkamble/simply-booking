import { prisma } from '@hotel-pms/database';

async function updatePropertyCategories() {
  console.log('🔄 Migrating categories in PostgreSQL DB...');

  const properties = await prisma.properties.findMany();

  for (const property of properties) {
    console.log(`\n🏨 Processing Property: "${property.name}" (${property.id})`);

    const starterCategories = [
      {
        name: 'Villa',
        description: 'Private luxury villa with pool & terrace',
        basePrice: property.currency === 'USD' ? 150 : 8000,
      },
      {
        name: 'Luxury Suite',
        description: 'Executive luxury suite with king bed & lounge',
        basePrice: property.currency === 'USD' ? 100 : 5000,
      },
      {
        name: 'Double Bed Room',
        description: 'Spacious room with 2 double beds & desk',
        basePrice: property.currency === 'USD' ? 70 : 3500,
      },
      {
        name: 'Single Bed Room',
        description: 'Cozy single bedroom with essential amenities',
        basePrice: property.currency === 'USD' ? 50 : 2500,
      },
    ];

    const categoryMap: Record<string, string> = {};

    for (const catData of starterCategories) {
      let cat = await prisma.roomCategories.findFirst({
        where: {
          propertyId: property.id,
          name: { equals: catData.name, mode: 'insensitive' },
        },
      });

      if (!cat) {
        cat = await prisma.roomCategories.create({
          data: {
            name: catData.name,
            description: catData.description,
            basePrice: catData.basePrice,
            propertyId: property.id,
          },
        });
        console.log(`   ✨ Created category: "${cat.name}" (Base ₹${cat.basePrice})`);
      } else {
        console.log(`   ✓ Found existing category: "${cat.name}"`);
      }

      categoryMap[catData.name] = cat.id;
    }

    // Find any "Standard Room" category for this property
    const standardCat = await prisma.roomCategories.findFirst({
      where: {
        propertyId: property.id,
        name: { equals: 'Standard Room', mode: 'insensitive' },
      },
      include: { rooms: true },
    });

    if (standardCat) {
      console.log(`   ⚠️ Found "Standard Room" category with ${standardCat.rooms.length} assigned room(s). Reassigning...`);

      for (const room of standardCat.rooms) {
        let targetCatId = categoryMap['Single Bed Room'];
        if (room.roomNumber.endsWith('2') || room.roomNumber.endsWith('5')) {
          targetCatId = categoryMap['Double Bed Room'];
        } else if (room.roomNumber.startsWith('3') || room.roomNumber.startsWith('4')) {
          targetCatId = categoryMap['Luxury Suite'];
        }

        await prisma.rooms.update({
          where: { id: room.id },
          data: { roomCategoryId: targetCatId },
        });
        console.log(`      -> Reassigned Room #${room.roomNumber} to category ID ${targetCatId}`);
      }

      await prisma.roomCategories.delete({
        where: { id: standardCat.id },
      });
      console.log(`   🗑️ Deleted "Standard Room" category from database.`);
    }
  }

  console.log('\n✅ DB Category Migration complete!');
}

updatePropertyCategories()
  .catch((err) => {
    console.error('❌ Migration failed:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
