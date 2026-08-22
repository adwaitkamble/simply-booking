import { Linking, Platform } from 'react-native';

export interface WhatsAppMessageDetails {
  guestName: string;
  guestPhone: string;
  propertyName?: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number | string;
  advancePaid?: number | string;
  balanceAmount?: number | string;
  bookingId?: string;
}

/**
 * Opens WhatsApp natively on Mobile or WhatsApp Web with pre-filled booking confirmation message
 */
export function sendWhatsAppConfirmation(details: WhatsAppMessageDetails) {
  const {
    guestName,
    guestPhone,
    propertyName = 'Simply Booking Hotel',
    roomName,
    checkIn,
    checkOut,
    totalAmount,
    advancePaid = 0,
    balanceAmount = 0,
    bookingId,
  } = details;

  // Format phone number with country code (defaults to 91 for India)
  let phoneDigits = (guestPhone || '').replace(/[^0-9]/g, '');
  if (phoneDigits.length === 10) {
    phoneDigits = '91' + phoneDigits;
  }

  const message =
    `Hello ${guestName || 'Guest'},\n\n` +
    `Your booking at *${propertyName}* is confirmed! 🎉\n\n` +
    (bookingId ? `🆔 *Booking Ref:* ${bookingId}\n` : '') +
    `🏨 *Room:* ${roomName}\n` +
    `📅 *Check-in:* ${checkIn}\n` +
    `📅 *Check-out:* ${checkOut}\n` +
    `💰 *Total Amount:* ₹${Number(totalAmount).toLocaleString('en-IN')}\n` +
    `💳 *Advance Paid:* ₹${Number(advancePaid).toLocaleString('en-IN')}\n` +
    `🔴 *Balance Due:* ₹${Number(balanceAmount).toLocaleString('en-IN')}\n\n` +
    `Thank you for choosing ${propertyName}. Have a wonderful stay! 🌿`;

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
