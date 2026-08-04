import { prisma } from '@hotel-pms/database';
import type {
  CreateInvoiceInput,
  InvoiceItemCategory,
} from '@hotel-pms/types';

export class InvoiceService {
  /**
   * Generates an invoice for a reservation with room stay and optional ancillary add-ons
   */
  static async generateInvoice(input: CreateInvoiceInput) {
    const { reservationId, ancillaryItems = [] } = input;

    if (!reservationId) {
      const error: any = new Error('reservationId is required to generate invoice');
      error.statusCode = 400;
      throw error;
    }

    // 1. Fetch reservation with guest, room, category, and property details
    const reservation = await prisma.reservations.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        room: {
          include: {
            roomCategory: {
              include: {
                property: {
                  include: {
                    chain: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!reservation) {
      const error: any = new Error(`Reservation with ID ${reservationId} not found`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Compute nights and base room charge
    const d1 = new Date(reservation.checkIn);
    const d2 = new Date(reservation.checkOut);
    const diffTime = d2.getTime() - d1.getTime();
    const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const basePrice = reservation.room.roomCategory.basePrice;
    const roomCharge = Math.round(nights * basePrice * 100) / 100;

    // 3. Format ancillary items
    const formattedAncillaryItems = ancillaryItems.map((item) => {
      const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const totalItemAmount = Math.round(Number(item.amount) * quantity * 100) / 100;
      return {
        description: item.description,
        amount: totalItemAmount,
        quantity,
        category: (item.category || 'Other') as InvoiceItemCategory,
      };
    });

    // 4. Calculate subtotal
    const ancillaryTotal = formattedAncillaryItems.reduce((acc, curr) => acc + curr.amount, 0);
    const subtotal = Math.round((roomCharge + ancillaryTotal) * 100) / 100;

    // 5. Calculate dynamic tax (18% standard hotel GST / occupancy tax)
    const taxRate = 0.18;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

    // 6. Execute atomic creation in PostgreSQL
    const invoice = await prisma.$transaction(async (tx) => {
      const createdInvoice = await tx.invoices.create({
        data: {
          reservationId: reservation.id,
          guestId: reservation.guestId,
          subtotal,
          taxAmount,
          grandTotal,
          status: 'Unpaid',
          items: {
            create: [
              {
                description: `${reservation.room.roomCategory.name} (${nights} night${nights > 1 ? 's' : ''} @ ₹${basePrice.toFixed(2)}/night)`,
                amount: roomCharge,
                quantity: nights,
                category: 'Room',
              },
              ...formattedAncillaryItems.map((item) => ({
                description: item.description,
                amount: item.amount,
                quantity: item.quantity,
                category: item.category as any,
              })),
            ],
          },
        },
        include: {
          items: true,
          reservation: {
            include: {
              guest: true,
              room: {
                include: {
                  roomCategory: {
                    include: {
                      property: {
                        include: {
                          chain: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          guest: true,
        },
      });

      return createdInvoice;
    });

    return invoice;
  }

  /**
   * Fetch invoice by ID with full itemized relations
   */
  static async getInvoiceById(invoiceId: string) {
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        guest: true,
        reservation: {
          include: {
            room: {
              include: {
                roomCategory: {
                  include: {
                    property: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      const error: any = new Error(`Invoice with ID ${invoiceId} not found`);
      error.statusCode = 404;
      throw error;
    }

    return invoice;
  }

  /**
   * Fetch invoice by Reservation ID
   */
  static async getInvoiceByReservationId(reservationId: string) {
    const invoice = await prisma.invoices.findFirst({
      where: { reservationId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        guest: true,
        reservation: {
          include: {
            room: {
              include: {
                roomCategory: {
                  include: {
                    property: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return invoice;
  }

  /**
   * Process payment for an invoice and mark reservation as CheckedOut
   */
  static async payInvoice(invoiceId: string) {
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: { reservation: true },
    });

    if (!invoice) {
      const error: any = new Error(`Invoice with ID ${invoiceId} not found`);
      error.statusCode = 404;
      throw error;
    }

    if (invoice.status === 'Paid') {
      const error: any = new Error('Invoice is already paid');
      error.statusCode = 400;
      throw error;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoices.update({
        where: { id: invoiceId },
        data: { status: 'Paid' },
        include: {
          items: true,
          guest: true,
        },
      });

      // Update reservation status to CheckedOut
      await tx.reservations.update({
        where: { id: invoice.reservationId },
        data: { status: 'CheckedOut' },
      });

      return updatedInvoice;
    });

    return result;
  }
}
