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
