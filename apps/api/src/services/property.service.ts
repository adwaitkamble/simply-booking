import { prisma } from '@hotel-pms/database';

export class PropertyService {
  /**
   * Fetch the property the authenticated user belongs to.
   *
   * This deliberately has no "default property" fallback. It used to fall back to
   * DEFAULT_PROPERTY_ID, then any property in Pune, then simply the newest property
   * in the database — so a freshly registered hotel was shown another tenant's rooms.
   * It also auto-created starter rooms, which is why new accounts appeared pre-populated.
   */
  static async getDefaultProperty(propertyId?: string) {
    if (!propertyId) {
      const error: any = new Error('No property is associated with this account.');
      error.statusCode = 404;
      throw error;
    }

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

    if (!property) {
      const error: any = new Error('Property not found for this account.');
      error.statusCode = 404;
      throw error;
    }

    return property;
  }

  /**
   * Fetch all properties
   */
  static async getAllProperties(propertyId?: string) {
    // Scoped to the caller's own property; without one, return nothing rather
    // than every property in the database.
    if (!propertyId) return [];

    return await prisma.properties.findMany({
      where: { id: propertyId },
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
