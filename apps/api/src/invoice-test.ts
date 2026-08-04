import { prisma } from '@hotel-pms/database';
import './server.js';

/**
 * Automated Financial & Folio Billing Calculation Verification Test
 *
 * Verifies:
 * 1. Test reservation creation (2 nights @ $200/night = $400 base room charge).
 * 2. Ancillary item aggregation ($50 Room Service F&B + $20 Laundry = $70).
 * 3. Dynamic Tax Calculation @ 18% ($84.60).
 * 4. Subtotal ($470.00) and Grand Total ($554.60) precision assertions.
 * 5. Payment settlement via PATCH /api/invoices/:id/pay and reservation checkout transition.
 */
async function runInvoiceFinancialTest() {
  console.log('===============================================================');
  console.log('💰 [FINANCIAL CALCULATION TEST] Invoicing & Folio Billing Engine');
  console.log('===============================================================');

  const SERVER_URL = 'http://localhost:4000';

  try {
    // 1. Setup Test Property, RoomCategory ($200/night), Room, and Guest
    console.log('\n[Step 1] Preparing database test fixture for 2-night stay @ $200/night...');

    let chain = await prisma.chains.findFirst();
    if (!chain) {
      chain = await prisma.chains.create({
        data: { name: 'Test Luxury Hotels Worldwide' },
      });
    }

    let property = await prisma.properties.findFirst({
      where: { chainId: chain.id },
    });
    if (!property) {
      property = await prisma.properties.create({
        data: {
          name: 'The Financial Grand Resort',
          address: '100 Financial Way',
          city: 'New York',
          country: 'USA',
          chainId: chain.id,
        },
      });
    }

    // Create or find a RoomCategory with basePrice = $200
    let roomCategory = await prisma.roomCategories.findFirst({
      where: { propertyId: property.id, basePrice: 200 },
    });
    if (!roomCategory) {
      roomCategory = await prisma.roomCategories.create({
        data: {
          name: 'Executive Deluxe Suite',
          basePrice: 200,
          propertyId: property.id,
        },
      });
    }

    // Create or find a Room
    let room = await prisma.rooms.findFirst({
      where: { roomCategoryId: roomCategory.id },
    });
    if (!room) {
      room = await prisma.rooms.create({
        data: {
          roomNumber: `FIN-${Math.floor(100 + Math.random() * 900)}`,
          roomCategoryId: roomCategory.id,
          status: 'Clean',
        },
      });
    }

    // Create or find a test Guest
    const guestEmail = `test.guest.${Date.now()}@financialpms.com`;
    const guest = await prisma.guests.create({
      data: {
        name: 'Alexander Hamilton',
        email: guestEmail,
        phone: '+1-555-0199',
      },
    });

    // Create 2-night test Reservation (e.g. 2026-11-01 to 2026-11-03)
    const checkIn = new Date('2026-11-01T14:00:00.000Z');
    const checkOut = new Date('2026-11-03T10:00:00.000Z'); // 2 nights
    const nights = 2;
    const baseRoomTotal = nights * roomCategory.basePrice; // 2 * 200 = 400

    const reservation = await prisma.reservations.create({
      data: {
        guestId: guest.id,
        roomId: room.id,
        checkIn,
        checkOut,
        totalAmount: baseRoomTotal,
        status: 'Confirmed',
      },
    });

    console.log(`✅ Test Reservation Created:`);
    console.log(`   Reservation ID:  ${reservation.id}`);
    console.log(`   Guest:           ${guest.name} (${guest.email})`);
    console.log(`   Room:            ${room.roomNumber} ($${roomCategory.basePrice}/night)`);
    console.log(`   Duration:        ${nights} Nights ($${baseRoomTotal.toFixed(2)})`);

    // 2. Define Ancillary Line Items
    console.log('\n[Step 2] Defining Ancillary Charges:');
    const ancillaryItems = [
      {
        description: 'Room Service - Breakfast',
        amount: 50,
        quantity: 1,
        category: 'FoodAndBeverage' as const,
      },
      {
        description: 'Express Laundry Service',
        amount: 20,
        quantity: 1,
        category: 'Laundry' as const,
      },
    ];
    ancillaryItems.forEach((item) => {
      console.log(`   + [${item.category}] ${item.description}: $${item.amount.toFixed(2)}`);
    });

    // 3. Call HTTP API POST /api/invoices/generate
    console.log('\n[Step 3] Calling POST /api/invoices/generate via HTTP API...');
    const generateRes = await fetch(`${SERVER_URL}/api/invoices/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId: reservation.id,
        ancillaryItems,
      }),
    });

    const generateJson: any = await generateRes.json();
    if (!generateRes.ok) {
      throw new Error(`Invoice generation failed: ${JSON.stringify(generateJson)}`);
    }

    const invoice = generateJson.data;
    console.log('✅ Invoice Generated Successfully:');
    console.log(`   Invoice ID:   ${invoice.id}`);
    console.log(`   Status:       ${invoice.status}`);
    console.log(`   Line Items:   ${invoice.items.length} items`);

    // 4. Assert Financial Calculations
    console.log('\n[Step 4] Programmatically Asserting Exact Financial Precision:');

    const expectedSubtotal = 470.0;
    const expectedTax = 84.6;
    const expectedGrandTotal = 554.6;

    console.log(`   Asserting Subtotal:     Expected $${expectedSubtotal.toFixed(2)} | Actual $${invoice.subtotal.toFixed(2)}`);
    if (Math.abs(invoice.subtotal - expectedSubtotal) > 0.001) {
      throw new Error(`Subtotal mismatch! Expected ${expectedSubtotal}, got ${invoice.subtotal}`);
    }

    console.log(`   Asserting Dynamic Tax:  Expected $${expectedTax.toFixed(2)} | Actual $${invoice.taxAmount.toFixed(2)} (18%)`);
    if (Math.abs(invoice.taxAmount - expectedTax) > 0.001) {
      throw new Error(`Tax amount mismatch! Expected ${expectedTax}, got ${invoice.taxAmount}`);
    }

    console.log(`   Asserting Grand Total:  Expected $${expectedGrandTotal.toFixed(2)} | Actual $${invoice.grandTotal.toFixed(2)}`);
    if (Math.abs(invoice.grandTotal - expectedGrandTotal) > 0.001) {
      throw new Error(`Grand Total mismatch! Expected ${expectedGrandTotal}, got ${invoice.grandTotal}`);
    }

    console.log('✅ All Financial Calculations Mathematically Verified (Subtotal: $470.00, Tax: $84.60, Grand Total: $554.60)!');

    // 5. Test Payment Settlement Endpoint PATCH /api/invoices/:id/pay
    console.log('\n[Step 5] Calling PATCH /api/invoices/:id/pay to settle bill and checkout...');
    const payRes = await fetch(`${SERVER_URL}/api/invoices/${invoice.id}/pay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });

    const payJson: any = await payRes.json();
    if (!payRes.ok) {
      throw new Error(`Invoice payment failed: ${JSON.stringify(payJson)}`);
    }

    console.log('✅ Payment Confirmed:');
    console.log(`   Invoice Status:      ${payJson.data.status}`);

    // Verify in PostgreSQL that reservation status transitioned to CheckedOut
    const updatedReservation = await prisma.reservations.findUnique({
      where: { id: reservation.id },
    });

    console.log(`   Reservation Status:  ${updatedReservation?.status}`);

    if (payJson.data.status !== 'Paid') {
      throw new Error(`Expected invoice status 'Paid', got ${payJson.data.status}`);
    }
    if (updatedReservation?.status !== 'CheckedOut') {
      throw new Error(`Expected reservation status 'CheckedOut', got ${updatedReservation?.status}`);
    }

    console.log('\n===============================================================');
    console.log('🎉 [FINANCIAL CALCULATION TEST PASSED] All calculations & states verified!');
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ [Financial Test Failed]:', error);
    process.exit(1);
  }
}

runInvoiceFinancialTest().then(() => {
  setTimeout(() => process.exit(0), 100);
});
