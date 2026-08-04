import { google } from 'googleapis';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

export interface CalendarSyncResult {
  success: boolean;
  eventId?: string;
  htmlLink?: string;
  summary?: string;
  mode: 'live' | 'mock';
  error?: string;
}

export class CalendarService {
  private static calendarClient: any = null;
  private static initialized: boolean = false;
  private static isConfigured: boolean = false;

  /**
   * Initialize the Google Calendar API client using Service Account credentials
   */
  private static initClient() {
    if (this.initialized) return;

    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      dotenv.config({ path: resolve(__dirname, '../../.env') });
    } catch {}
    dotenv.config({ path: resolve(process.cwd(), 'apps/api/.env') });
    dotenv.config({ path: resolve(process.cwd(), '.env') });

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (clientEmail && rawPrivateKey) {
      try {
        const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
        const auth = new google.auth.JWT({
          email: clientEmail,
          key: privateKey,
          scopes: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
          ],
        });

        this.calendarClient = google.calendar({ version: 'v3', auth });
        this.isConfigured = true;
        console.log(`📅 [Google Calendar] Client authenticated with Service Account: ${clientEmail}`);
      } catch (err: any) {
        console.warn(`⚠️ [Google Calendar] Failed to initialize JWT auth: ${err.message}`);
        this.isConfigured = false;
      }
    } else {
      console.log('ℹ️ [Google Calendar] GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY not set. Operating in mock/dry-run mode.');
      this.isConfigured = false;
    }

    this.initialized = true;
  }

  /**
   * Sync a confirmed reservation to the management Google Calendar
   * Summary: [RoomNumber] - Guest: [GuestName]
   * Start / End: checkIn and checkOut dateTimes
   */
  static async syncReservationToCalendar(
    reservation: any,
    room: any,
    guest: any
  ): Promise<CalendarSyncResult> {
    this.initClient();

    const roomNumber = room?.roomNumber || 'Unknown';
    const guestName = guest?.name || 'Guest';
    const guestEmail = guest?.email || 'N/A';
    const guestPhone = guest?.phone || 'N/A';
    const categoryName = room?.roomCategory?.name || 'Room';
    const propertyName = room?.roomCategory?.property?.name || 'The Royal Maratha Heritage Resort & Spa, Pune';

    const summary = `${roomNumber} - Guest: ${guestName}`;
    const checkInIso = new Date(reservation.checkIn).toISOString();
    const checkOutIso = new Date(reservation.checkOut).toISOString();

    const description = [
      `🏨 ${propertyName} - In-House Reservation`,
      '==================================================',
      `• Reservation ID: ${reservation.id}`,
      `• Room: ${roomNumber} (${categoryName})`,
      `• Guest: ${guestName}`,
      `• Email: ${guestEmail}`,
      `• Phone: ${guestPhone}`,
      `• Occupancy: ${reservation.adults || 1} Adult(s), ${reservation.children || 0} Child(ren)`,
      `• Check-In Time: ${reservation.checkInTime || '12:00 PM'}`,
      `• Check-Out Time: ${reservation.checkOutTime || '11:00 AM'}`,
      `• Total Rate: ₹${Number(reservation.totalAmount).toLocaleString('en-IN')}`,
      `• Advance Paid: ₹${Number(reservation.advancePaid || 0).toLocaleString('en-IN')}`,
      `• Balance Due: ₹${Math.max(0, Number(reservation.totalAmount) - Number(reservation.advancePaid || 0)).toLocaleString('en-IN')}`,
      `• Status: ${reservation.status}`,
      reservation.notes ? `• Notes: ${reservation.notes}` : '',
      '==================================================',
      'Synced automatically by Royal Maratha Hotel PMS Booking Engine',
    ].filter(Boolean).join('\n');

    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    const eventPayload = {
      summary,
      description,
      location: propertyName,
      start: {
        dateTime: checkInIso,
        timeZone: 'UTC',
      },
      end: {
        dateTime: checkOutIso,
        timeZone: 'UTC',
      },
      status: 'confirmed',
    };

    // 1. Live Google Calendar API Sync
    if (this.isConfigured && this.calendarClient) {
      try {
        const response = await this.calendarClient.events.insert({
          calendarId,
          requestBody: eventPayload,
        });

        console.log(`🟢 [Google Calendar Sync] Event published to Calendar ID: ${calendarId}`);
        console.log(`   Event ID: ${response.data.id} | Link: ${response.data.htmlLink}`);

        return {
          success: true,
          eventId: response.data.id,
          htmlLink: response.data.htmlLink,
          summary,
          mode: 'live',
        };
      } catch (err: any) {
        console.warn(`⚠️ [Google Calendar Sync Failed]: ${err.message}`);
        return {
          success: false,
          summary,
          mode: 'live',
          error: err.message,
        };
      }
    }

    // 2. Mock / Dry-run Mode when credentials are not configured in local environment
    const mockEventId = `mock_cal_evt_${Date.now()}`;
    console.log(`ℹ️ [Google Calendar Mock Sync] Simulated event creation for Calendar [${calendarId}]:`);
    console.log(`   Summary:     "${summary}"`);
    console.log(`   Date Window: ${checkInIso} ➔ ${checkOutIso}`);
    console.log(`   Event ID:    ${mockEventId}`);

    return {
      success: true,
      eventId: mockEventId,
      htmlLink: `https://calendar.google.com/calendar/event?eid=${mockEventId}`,
      summary,
      mode: 'mock',
    };
  }
}
