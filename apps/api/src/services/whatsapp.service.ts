import dotenv from 'dotenv';

export interface WhatsAppPayload {
  guestName: string;
  guestPhone: string;
  propertyName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  advancePaid?: number;
  pendingAmount: number;
  currency: string;
  bookingRef?: string;
  calendarLink?: string;
}

export class WhatsAppService {
  /**
   * Send WhatsApp booking confirmation message via Twilio (with mock fallback)
   */
  static async sendBookingConfirmation(payload: WhatsAppPayload): Promise<{ success: boolean; messageId?: string; mode: 'live' | 'mock' }> {
    const {
      guestName,
      guestPhone,
      propertyName,
      roomNumber,
      checkIn,
      checkOut,
      totalAmount,
      advancePaid = 0,
      pendingAmount,
      currency,
      bookingRef,
      calendarLink,
    } = payload;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Default Twilio Sandbox

    // Normalize phone number: Ensure it has 'whatsapp:' prefix for Twilio, and strip space
    let formattedPhone = guestPhone.replace(/\s+/g, '');
    if (!formattedPhone.startsWith('whatsapp:')) {
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }
      formattedPhone = `whatsapp:${formattedPhone}`;
    }

    const hotelName = propertyName && propertyName.trim() ? propertyName.trim() : 'Hotel Property';
    const formattedTotal = Number(totalAmount).toLocaleString('en-IN');
    const formattedAdvance = Number(advancePaid).toLocaleString('en-IN');
    const formattedPending = Number(pendingAmount).toLocaleString('en-IN');
    const currencySymbol = currency === 'INR' ? '₹' : currency;

    const messageBody =
      `Hello ${guestName},\n\n` +
      `Your booking at *${hotelName}* is confirmed! 🎉\n\n` +
      (bookingRef ? `🆔 *Booking Ref:* ${bookingRef}\n` : '') +
      `🏨 *Room:* Room ${roomNumber}\n` +
      `📅 *Check-in:* ${checkIn}\n` +
      `📅 *Check-out:* ${checkOut}\n` +
      `💰 *Total Amount:* ${currencySymbol}${formattedTotal}\n` +
      `💳 *Advance Paid:* ${currencySymbol}${formattedAdvance}\n` +
      `🔴 *Balance Due:* ${currencySymbol}${formattedPending}\n\n` +
      (calendarLink ? `📅 *Google Calendar Link:* ${calendarLink}\n\n` : '') +
      `Thank you for choosing *${hotelName}*. Have a wonderful stay! 🌿`;

    // 1. Live Twilio API Integration
    if (accountSid && authToken) {
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        const params = new URLSearchParams();
        params.append('From', fromWhatsApp);
        params.append('To', formattedPhone);
        params.append('Body', messageBody);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        const json: any = await response.json();

        if (!response.ok) {
          throw new Error(json.message || `Twilio HTTP error ${response.status}`);
        }

        console.log(`🟢 [WhatsApp Live Sent] Confirmation sent to ${formattedPhone}. Message SID: ${json.sid}`);
        return {
          success: true,
          messageId: json.sid,
          mode: 'live',
        };
      } catch (err: any) {
        console.warn(`⚠️ [WhatsApp Live Send Failed]: ${err.message}. Falling back to simulated log.`);
      }
    }

    // 2. Mock / Dry-run Mode when credentials are not configured in local environment
    const mockMsgId = `mock_wa_msg_${Date.now()}`;
    console.log(`\n📱 [WhatsApp Mock Notification]`);
    console.log(`   From:        ${fromWhatsApp}`);
    console.log(`   To:          ${formattedPhone}`);
    console.log(`   Message ID:  ${mockMsgId}`);
    console.log(`   --- MESSAGE BODY ---`);
    console.log(messageBody);
    console.log(`   ---------------------\n`);

    return {
      success: true,
      messageId: mockMsgId,
      mode: 'mock',
    };
  }
}
