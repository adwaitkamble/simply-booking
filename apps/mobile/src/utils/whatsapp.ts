import { Linking, Platform } from 'react-native';

export interface WhatsAppMessageDetails {
  guestName: string;
  guestPhone: string;
  /** The hotel the guest actually booked — required so the app name can never stand in for it. */
  propertyName: string;
  /** Room category, e.g. "Single Bed Room" */
  roomType?: string;
  roomNumber?: string | number;
  roomName: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number | string;
  advancePaid?: number | string;
  balanceAmount?: number | string;
}

/**
 * Opens WhatsApp natively on Mobile or WhatsApp Web with pre-filled booking confirmation message
 */
export function sendWhatsAppConfirmation(details: WhatsAppMessageDetails) {
  const {
    guestName,
    guestPhone,
    propertyName,
    roomType,
    roomNumber,
    roomName,
    checkIn,
    checkOut,
    totalAmount,
    advancePaid = 0,
    balanceAmount = 0,
  } = details;

  const hotelName = (propertyName || '').trim() || 'our hotel';

  // Prefer "Single Bed Room · Room 102" when the category is known.
  const roomLine = roomType
    ? `${roomType}${roomNumber ? ` · Room ${roomNumber}` : ''}`
    : roomName;

  // Format phone number with country code (defaults to 91 for India)
  let phoneDigits = (guestPhone || '').replace(/[^0-9]/g, '');
  if (phoneDigits.length === 10) {
    phoneDigits = '91' + phoneDigits;
  }

  const message =
    `Hello ${guestName || 'Guest'},\n\n` +
    `Your booking at *${hotelName}* is confirmed! 🎉\n\n` +
    `🏨 *Room:* ${roomLine}\n` +
    `📅 *Check-in:* ${checkIn}\n` +
    `📅 *Check-out:* ${checkOut}\n` +
    `💰 *Total Amount:* ₹${Number(totalAmount).toLocaleString('en-IN')}\n` +
    `💳 *Advance Paid:* ₹${Number(advancePaid).toLocaleString('en-IN')}\n` +
    `🔴 *Balance Due:* ₹${Number(balanceAmount).toLocaleString('en-IN')}\n\n` +
    `Thank you for choosing *${hotelName}*. Have a wonderful stay! 🌿`;

  const encodedMsg = encodeURIComponent(message);
  const appUrl = `whatsapp://send?phone=${phoneDigits}&text=${encodedMsg}`;
  const webUrl = `https://wa.me/${phoneDigits}?text=${encodedMsg}`;

  if (Platform.OS === 'web') {
    window.open(webUrl, '_blank');
  } else {
    Linking.canOpenURL(appUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(appUrl);
        } else {
          return Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Linking.openURL(webUrl);
      });
  }
}

export interface WhatsAppInvoiceDetails {
  guestName: string;
  guestPhone: string;
  propertyName: string;
  invoiceNo: string;
  roomType?: string;
  roomNumber?: string | number;
  checkIn: string;
  checkOut: string;
  nights: number;
  grossTotal: number | string;
  advancePaid: number | string;
  settlementPaid: number | string;
  balanceDue: number | string;
  paymentMethod: string;
  isPaid: boolean;
}

/**
 * Sends GST Tax Invoice summary directly to the guest via WhatsApp
 */
export function sendWhatsAppInvoice(details: WhatsAppInvoiceDetails) {
  const {
    guestName,
    guestPhone,
    propertyName,
    invoiceNo,
    roomType,
    roomNumber,
    checkIn,
    checkOut,
    nights,
    grossTotal,
    advancePaid = 0,
    settlementPaid = 0,
    balanceDue = 0,
    paymentMethod = 'UPI',
    isPaid = true,
  } = details;

  const hotelName = (propertyName || '').trim() || 'our hotel';
  const roomLine = roomType
    ? `${roomType}${roomNumber ? ` · Room ${roomNumber}` : ''}`
    : `Room ${roomNumber || ''}`;

  let phoneDigits = (guestPhone || '').replace(/[^0-9]/g, '');
  if (phoneDigits.length === 10) {
    phoneDigits = '91' + phoneDigits;
  }

  const message =
    `Hello ${guestName || 'Valued Guest'},\n\n` +
    `Here is your official GST Tax Invoice from *${hotelName}* 🧾\n\n` +
    `📄 *Invoice No:* ${invoiceNo}\n` +
    `🏨 *Stay:* ${roomLine} (${nights} night${nights > 1 ? 's' : ''})\n` +
    `📅 *Dates:* ${checkIn} to ${checkOut}\n` +
    `──────────────────────\n` +
    `💵 *Total Bill (GST Incl.):* ₹${Number(grossTotal).toLocaleString('en-IN')}\n` +
    `💳 *Less Advance Paid:* -₹${Number(advancePaid).toLocaleString('en-IN')}\n` +
    (isPaid
      ? `✅ *Settlement Paid at Checkout:* ₹${Number(settlementPaid).toLocaleString('en-IN')} (${paymentMethod.toUpperCase()})\n` +
        `🟢 *Status:* FULLY SETTLED & CHECKED OUT 🎉\n`
      : `🔴 *Net Balance Due:* ₹${Number(balanceDue).toLocaleString('en-IN')}\n` +
        `🟡 *Status:* PENDING SETTLEMENT\n`) +
    `──────────────────────\n\n` +
    `Thank you for staying with *${hotelName}*. We look forward to welcoming you again! 🌿`;

  const encodedMsg = encodeURIComponent(message);
  const appUrl = `whatsapp://send?phone=${phoneDigits}&text=${encodedMsg}`;
  const webUrl = `https://wa.me/${phoneDigits}?text=${encodedMsg}`;

  if (Platform.OS === 'web') {
    window.open(webUrl, '_blank');
  } else {
    Linking.canOpenURL(appUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(appUrl);
        } else {
          return Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Linking.openURL(webUrl);
      });
  }
}
