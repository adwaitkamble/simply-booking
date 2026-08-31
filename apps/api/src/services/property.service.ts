import { prisma } from '@hotel-pms/database';

export class PropertyService {
  /**
   * Fetch the default primary in-house property for the PMS
   */
  static async getDefaultProperty(propertyId?: string) {
    if (propertyId) {
      const property = await prisma.properties.findUnique({
        where: { id: propertyId },
        include: {
          chain: true,
          roomCategories: {
            include: {
              rooms: true,
            },
          },
        },
      });

      if (property) return property;
    }

    const defaultPropertyId = process.env.DEFAULT_PROPERTY_ID;

    if (defaultPropertyId) {
      const property = await prisma.properties.findUnique({
        where: { id: defaultPropertyId },
        include: {
          chain: true,
          roomCategories: {
            include: {
              rooms: true,
            },
          },
        },
      });

      if (property) return property;
    }

    // Fallback: Fetch Pune property or latest active property in the database
    const property = (await prisma.properties.findFirst({
      where: { city: 'Pune' },
      include: {
        chain: true,
        roomCategories: {
          include: {
            rooms: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })) || (await prisma.properties.findFirst({
      include: {
        chain: true,
        roomCategories: {
          include: {
            rooms: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }));

    if (!property) {
      const error: any = new Error('No hotel property found in database. Please run seed script or register.');
      error.statusCode = 404;
      throw error;
    }

    // Auto-initialize starter room categories and rooms if property has 0 rooms
    const totalRooms = property.roomCategories?.reduce((acc, cat) => acc + (cat.rooms?.length || 0), 0) || 0;
    if (totalRooms === 0) {
      if (property.roomCategories.length === 0) {
        const starterCategories = [
          { name: 'Deluxe Heritage Room', description: 'Spacious king bedroom with garden view', basePrice: 2800.0, rooms: ['101', '102', '103'] },
          { name: 'Executive Garden Suite', description: 'Luxury suite with balcony overlooking pool', basePrice: 4500.0, rooms: ['201', '202', '203'] },
          { name: 'Royal Penthouse', description: 'Top-tier luxury penthouse with scenic views', basePrice: 8500.0, rooms: ['301', '302', '303'] },
        ];
        for (const cat of starterCategories) {
          const createdCat = await prisma.roomCategories.create({
            data: {
              name: cat.name,
              description: cat.description,
              basePrice: cat.basePrice,
              propertyId: property.id,
            },
          });
          for (const rNum of cat.rooms) {
            await prisma.rooms.create({
              data: {
                roomNumber: rNum,
                pricePerNight: cat.basePrice,
                status: 'Clean',
                roomCategoryId: createdCat.id,
              },
            });
          }
        }
      } else {
        for (let i = 0; i < property.roomCategories.length; i++) {
          const cat = property.roomCategories[i];
          const floor = i + 1;
          for (const rNum of [`${floor}01`, `${floor}02`, `${floor}03`]) {
            await prisma.rooms.create({
              data: {
                roomNumber: rNum,
                pricePerNight: cat.basePrice,
                status: 'Clean',
                roomCategoryId: cat.id,
              },
            });
          }
        }
      }

      return await prisma.properties.findUnique({
        where: { id: property.id },
        include: {
          chain: true,
          roomCategories: {
            include: {
              rooms: true,
            },
          },
        },
      }) as any;
    }

    return property;
  }

  /**
   * Fetch all properties
   */
  static async getAllProperties(propertyId?: string) {
    return await prisma.properties.findMany({
      where: propertyId ? { id: propertyId } : undefined,
      include: {
        chain: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Fetch property by ID
   */
  static async getPropertyById(id: string) {
    const property = await prisma.properties.findUnique({
      where: { id },
      include: {
        chain: true,
        roomCategories: {
          include: {
            rooms: true,
          },
        },
      },
    });

    if (!property) {
      const error: any = new Error(`Property with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    return property;
  }
}
