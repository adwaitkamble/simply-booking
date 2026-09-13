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
