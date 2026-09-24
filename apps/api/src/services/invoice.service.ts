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

    // 2. Compute stay duration (nights)
    const d1 = new Date(reservation.checkIn);
    const d2 = new Date(reservation.checkOut);
    const diffTime = d2.getTime() - d1.getTime();
    const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // 3. Determine agreed room rate per night (inclusive of GST)
    // If reservation has a custom totalAmount set during booking, use it as agreed stay price
    const agreedTotalStayAmount = reservation.totalAmount > 0
      ? reservation.totalAmount
      : (nights * ((reservation.room as any).pricePerNight ?? reservation.room.roomCategory.basePrice));

    const ratePerNightInclusive = Math.round((agreedTotalStayAmount / nights) * 100) / 100;
    const roomStayGross = Math.round(nights * ratePerNightInclusive * 100) / 100;

    // 4. Format ancillary items
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

    const ancillaryTotal = formattedAncillaryItems.reduce((acc, curr) => acc + curr.amount, 0);

    // 5. Total Gross Charges (agreed room stay + add-ons, inclusive of GST)
    const grossTotal = Math.round((roomStayGross + ancillaryTotal) * 100) / 100;

    // 6. GST Inclusive Decomposition (Standard 18% GST: 9% CGST + 9% SGST)
    const taxRate = 0.18;
    const taxableBase = Math.round((grossTotal / (1 + taxRate)) * 100) / 100;
    const totalTax = Math.round((grossTotal - taxableBase) * 100) / 100;
    const subtotal = taxableBase;
    const taxAmount = totalTax;
    const grandTotal = grossTotal;

    // 7. Check for existing invoice for this reservation to allow update/re-calculation
    const existingInvoice = await prisma.invoices.findFirst({
      where: { reservationId: reservation.id },
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

    // If already Paid, return existing settled invoice
    if (existingInvoice && existingInvoice.status === 'Paid') {
      return existingInvoice;
    }

    const itemsData = [
      {
        description: `${reservation.room.roomCategory.name} - Room ${reservation.room.roomNumber} (${nights} night${nights > 1 ? 's' : ''} @ ₹${ratePerNightInclusive.toFixed(2)}/night incl. GST)`,
        amount: roomStayGross,
        quantity: nights,
        category: 'Room' as InvoiceItemCategory,
      },
      ...formattedAncillaryItems.map((item) => ({
        description: item.description,
        amount: item.amount,
        quantity: item.quantity,
        category: item.category as InvoiceItemCategory,
      })),
    ];

    // 8. Execute atomic creation / update in PostgreSQL
    const invoice = await prisma.$transaction(async (tx) => {
      if (existingInvoice) {
        await tx.invoiceItems.deleteMany({
          where: { invoiceId: existingInvoice.id },
        });

        const updated = await tx.invoices.update({
          where: { id: existingInvoice.id },
          data: {
            subtotal,
            taxAmount,
            grandTotal,
            items: {
              create: itemsData,
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
        return updated;
      }

      const createdInvoice = await tx.invoices.create({
        data: {
          reservationId: reservation.id,
          guestId: reservation.guestId,
          subtotal,
          taxAmount,
          grandTotal,
          status: 'Unpaid',
          items: {
            create: itemsData,
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
          reservation: {
            include: {
              guest: true,
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
