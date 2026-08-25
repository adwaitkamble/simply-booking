import type {
  CreateReservationInput,
  CreateRoomInput,
  RoomStatus,
  RoomStatusLogDTO,
  InvoiceStatus,
  InvoiceItemCategory,
  CreateInvoiceInput,
  InvoiceDTO,
  InvoiceItemDTO,
  OTAInboundWebhookPayload,
  OTAWebhookResponse,
  ChannelSyncLogDTO,
  ChannelDistributionMetricsDTO,
  RegisterPayload,
  LoginPayload,
  AuthResponse,
  UserDTO,
  CreateTeamMemberPayload,
  UpdateTeamMemberPayload,
  NotificationDTO,
} from '@hotel-pms/types';

export interface AvailableRoomItem {
  id: string;
  roomNumber: string;
  pricePerNight?: number | null;
  roomSize?: string | null;
  status: RoomStatus;
  roomCategoryId: string;
  createdAt: string;
  updatedAt: string;
  roomCategory: {
    id: string;
    name: string;
    description: string | null;
    basePrice: number;
    propertyId: string;
    property: {
      id: string;
      name: string;
      address: string;
      city: string;
      country: string;
      chainId: string;
      chain: {
        id: string;
        name: string;
      };
    };
  };
}

export interface HousekeepingRoomItem {
  id: string;
  roomNumber: string;
  status: RoomStatus;
  roomCategoryId: string;
  createdAt: string;
  updatedAt: string;
  roomCategory: {
    id: string;
    name: string;
    description: string | null;
    basePrice: number;
    property: {
      id: string;
      name: string;
      city: string;
    };
  };
  statusLogs?: Array<{
    id: string;
    previousStatus: RoomStatus;
    newStatus: RoomStatus;
    changedAt: string;
    turnoverDurationSeconds?: number | null;
  }>;
}

export interface ApiReservationResponse {
  success: boolean;
  message?: string;
  data: any;
  error?: string;
  statusCode?: number;
}

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

let customApiBaseUrl: string | null = null;
let currentAuthToken: string | null = null;

function resolveApiBaseUrl(): string {
  if (customApiBaseUrl) {
    return customApiBaseUrl;
  }

  // 1. Prioritize dynamic Metro bundler host IP (e.g. 192.168.0.101:8081) for real devices & Expo Go
  try {
    const Constants = require('expo-constants')?.default || require('expo-constants');
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoClient?.hostUri ||
      Constants?.manifest?.debuggerHost ||
      Constants?.manifest?.hostUri;

    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:4000/api`;
      }
    }
  } catch {
    // Expo constants not available in node test environment
  }

  // 2. Use EXPO_PUBLIC_API_URL if configured
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 3. Fallback for Android Emulator (10.0.2.2 maps to host 127.0.0.1)
  try {
    const RN = require('react-native');
    if (RN?.Platform?.OS === 'android') {
      return 'http://192.168.0.101:4000/api';
    }
  } catch {
    // React Native not available in node test runner
  }

  return 'http://192.168.0.101:4000/api';
}

function getRequestHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  if (currentAuthToken) {
    headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }
  return headers;
}

async function safeParseJsonResponse(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  let json: any = null;
  if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON format
    }
  }

  if (!res.ok) {
    const errorMsg = json?.error || (text ? text.replace(/<[^>]*>/g, '').trim().slice(0, 150) : `HTTP Error ${res.status}`);
    throw new ApiError(errorMsg || `Server error (${res.status})`, res.status);
  }

  if (!json) {
    throw new ApiError(`Invalid server response format (${res.status})`, res.status);
  }

  return json;
}

export const ApiClient = {
  setBaseUrl(url: string) {
    customApiBaseUrl = url;
  },

  getBaseUrl(): string {
    return resolveApiBaseUrl();
  },

  getSocketUrl(): string {
    return resolveApiBaseUrl().replace(/\/api\/?$/, '');
  },

  setAuthToken(token: string | null) {
    currentAuthToken = token;
  },

  getAuthToken(): string | null {
    return currentAuthToken;
  },

  /**
   * ==========================================
   * AUTHENTICATION APIS
   * ==========================================
   */

  /**
   * Register a new Tenant Property & Owner User
   */
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await fetch(`${resolveApiBaseUrl()}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await safeParseJsonResponse(res);
    if (json.token) {
      ApiClient.setAuthToken(json.token);
    }
    return json;
  },

  /**
   * Log in to existing account
   */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await fetch(`${resolveApiBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await safeParseJsonResponse(res);
    if (json.token) {
      ApiClient.setAuthToken(json.token);
    }
    return json;
  },

  /**
   * Change user password securely
   */
  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${resolveApiBaseUrl()}/auth/change-password`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await safeParseJsonResponse(res);
    return json;
  },

  /**
   * Fetch all team members for property
   */
  async fetchTeamMembers(): Promise<UserDTO[]> {
    const res = await fetch(`${resolveApiBaseUrl()}/team`, {
      headers: getRequestHeaders(),
    });

    const json = await safeParseJsonResponse(res);
    return json.data || [];
  },

  /**
   * Create new team member (Admin only)
   */
  async createTeamMember(payload: CreateTeamMemberPayload): Promise<UserDTO> {
    const res = await fetch(`${resolveApiBaseUrl()}/team/create-member`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await safeParseJsonResponse(res);
    return json.data;
  },

  /**
   * Update team member permissions & status (Admin only)
   */
  async updateTeamMember(id: string, payload: UpdateTeamMemberPayload): Promise<UserDTO> {
    const res = await fetch(`${resolveApiBaseUrl()}/team/${id}`, {
      method: 'PUT',
      headers: getRequestHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await safeParseJsonResponse(res);
    return json.data;
  },

  /**
   * Delete team member (Admin only)
   */
  async deleteTeamMember(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${resolveApiBaseUrl()}/team/${id}`, {
      method: 'DELETE',
      headers: getRequestHeaders(),
    });

    const json = await safeParseJsonResponse(res);
    return json;
  },

  /**
   * Save device Expo Push Token to user profile
   */
  async savePushToken(token: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${resolveApiBaseUrl()}/notifications/token`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({ token }),
    });

    const json = await safeParseJsonResponse(res);
    return json;
  },

  /**
   * Fetch top 50 notifications for logged-in user
   */
  async fetchNotifications(): Promise<{ notifications: NotificationDTO[]; unreadCount: number }> {
    const res = await fetch(`${resolveApiBaseUrl()}/notifications`, {
      headers: getRequestHeaders(),
    });

    const json = await safeParseJsonResponse(res);
    return {
      notifications: json.data || [],
      unreadCount: json.unreadCount || 0,
    };
  },

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string): Promise<NotificationDTO> {
    const res = await fetch(`${resolveApiBaseUrl()}/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: getRequestHeaders(),
    });

    const json = await safeParseJsonResponse(res);
    return json.data;
  },

  /**
   * Fetch current authenticated user & property
   */
  async fetchMe(): Promise<any> {
    const res = await fetch(`${resolveApiBaseUrl()}/auth/me`, {
      headers: getRequestHeaders(),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to fetch user session', res.status);
    }
    return json.data;
  },

  /**
   * ==========================================
   * PMS CORE OPERATIONAL APIS
   * ==========================================
   */

  /**
   * Fetch the default in-house property details
   */
  async fetchDefaultProperty(): Promise<any> {
    const res = await fetch(`${resolveApiBaseUrl()}/properties/default`, {
      headers: getRequestHeaders(),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to fetch default property', res.status);
    }

    return json.data;
  },

  /**
   * Fetch all rooms belonging to a property
   */
  async fetchPropertyRooms(propertyId: string): Promise<any[]> {
    const res = await fetch(`${resolveApiBaseUrl()}/properties/${propertyId}/rooms`, {
      headers: getRequestHeaders(),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to fetch property rooms', res.status);
    }

    return json.data || [];
  },

  /**
   * Create a new room on the fly
   */
  async createRoom(data: CreateRoomInput): Promise<any> {
    const res = await fetch(`${resolveApiBaseUrl()}/rooms`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to create room', res.status);
    }

    return json.data;
  },

  /**
   * Delete a room by ID
   */
  async deleteRoom(roomId: string): Promise<any> {
    const res = await fetch(`${resolveApiBaseUrl()}/rooms/${roomId}`, {
      method: 'DELETE',
      headers: getRequestHeaders(),
    });

    const json = await safeParseJsonResponse(res);
    return json.data;
  },

  /**
   * Fetch UI-mapped bookings with date overlap filtering
   */
  async fetchBookings(startDate?: string, endDate?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const baseUrl = resolveApiBaseUrl();

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/bookings${queryStr}`, {
        headers: getRequestHeaders(),
      });
      if (res.status === 404) {
        res = await fetch(`${baseUrl}/reservations${queryStr}`, {
          headers: getRequestHeaders(),
        });
      }
    } catch {
      res = await fetch(`${baseUrl}/reservations${queryStr}`, {
        headers: getRequestHeaders(),
      });
    }

    const json = await safeParseJsonResponse(res);
    return json.data || [];
  },

  /**
   * Send WhatsApp booking confirmation notification
   */
  async sendWhatsAppNotification(reservationId: string): Promise<any> {
    const res = await fetch(`${resolveApiBaseUrl()}/reservations/${reservationId}/whatsapp`, {
      method: 'POST',
      headers: getRequestHeaders(),
    });

    const json = await safeParseJsonResponse(res);
    return json;
  },

  /**
   * Fetch rooms inventory data with stats { total, used } and mapped room cards
   */
  async fetchRoomsData(): Promise<{
    stats: { total: number; used: number };
    rooms: Array<{
      roomId: string;
      imageUrl: string;
      categoryName: string;
      roomName: string;
      status: string;
      childCount: number;
      adultCount: number;
    }>;
  }> {
    const res = await fetch(`${resolveApiBaseUrl()}/rooms`, {
      headers: getRequestHeaders(),
    });

    const json = await safeParseJsonResponse(res);
    return {
      stats: json.stats || { total: 0, used: 0 },
      rooms: json.rooms || [],
    };
  },

  /**
   * ==========================================
   * MY TEAM MEMBER APIS
   * ==========================================
   */

  /**
   * Fetch team members and subscription limits
   */
  async fetchTeamData(): Promise<{
    stats: { used: number; limit: number; isLimitReached: boolean };
    members: Array<{
      id: string;
      name: string;
      email: string;
      role: 'Admin' | 'Staff';
      isActive: boolean;
      isPrimaryOwner: boolean;
    }>;
  }> {
    const res = await fetch(`${resolveApiBaseUrl()}/team`, {
      headers: getRequestHeaders(),
    });

    const json = await safeParseJsonResponse(res);
    const rawMembers = Array.isArray(json.members)
      ? json.members
      : Array.isArray(json.data)
      ? json.data
      : [];

    return {
      stats: json.stats || { used: rawMembers.length, limit: 50, isLimitReached: false },
      members: rawMembers.map((m: any) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role || 'Staff',
        isActive: m.isActive ?? true,
        isPrimaryOwner: m.role === 'Admin',
      })),
    };
  },

  /**
   * Toggle team member active/inactive status
   */
  async updateMemberStatus(memberId: string, isActive: boolean): Promise<any> {
    const res = await fetch(`${resolveApiBaseUrl()}/team/${memberId}/status`, {
      method: 'PATCH',
      headers: getRequestHeaders(),
      body: JSON.stringify({ isActive }),
    });

    const json = await safeParseJsonResponse(res);
    return json.data;
  },



  /**
   * Invite/Add new team member
   */
  async inviteTeamMember(memberData: {
    name: string;
    email: string;
    role: 'Admin' | 'Staff';
  }): Promise<any> {
    const res = await fetch(`${resolveApiBaseUrl()}/team/invite`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(memberData),
    });

    const json = await safeParseJsonResponse(res);
    return json.member;
  },

  /**
   * Create a new room category dynamically
   */
  async createRoomCategory(data: {
    name: string;
    description?: string;
    basePrice: number;
  }): Promise<any> {
    const res = await fetch(`${resolveApiBaseUrl()}/rooms/categories`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(data),
    });

    const json = await safeParseJsonResponse(res);
    return json.data;
  },

  /**
   * Delete a room category by ID
   */
  async deleteRoomCategory(categoryId: string): Promise<any> {
    const res = await fetch(`${resolveApiBaseUrl()}/rooms/categories/${categoryId}`, {
      method: 'DELETE',
      headers: getRequestHeaders(),
    });

    const json = await safeParseJsonResponse(res);
    return json.data;
  },

  /**
   * Fetch all room categories for tenant property
   */
  async fetchRoomCategories(): Promise<any[]> {
    const res = await fetch(`${resolveApiBaseUrl()}/rooms/categories`, {
      headers: getRequestHeaders(),
    });

    const json = await safeParseJsonResponse(res);
    return json.data || [];
  },

  /**
   * Fetch rooms without overlapping reservations for dates
   */
  async fetchAvailableRooms(
    checkIn: string,
    checkOut: string,
    propertyId?: string
  ): Promise<AvailableRoomItem[]> {
    const params = new URLSearchParams({
      checkIn,
      checkOut,
    });
    if (propertyId) {
      params.append('propertyId', propertyId);
    }

    const res = await fetch(`${resolveApiBaseUrl()}/rooms/available?${params.toString()}`, {
      headers: getRequestHeaders(),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to fetch available rooms', res.status);
    }

    return json.data || [];
  },

  /**
   * Fetch rooms requiring housekeeping turnover
   */
  async fetchHousekeepingRooms(propertyId?: string): Promise<HousekeepingRoomItem[]> {
    const params = new URLSearchParams();
    if (propertyId) {
      params.append('propertyId', propertyId);
    }

    const res = await fetch(`${resolveApiBaseUrl()}/rooms/housekeeping?${params.toString()}`, {
      headers: getRequestHeaders(),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to fetch housekeeping rooms', res.status);
    }

    return json.data || [];
  },

  /**
   * Update room status (Clean / Dirty / Maintenance)
   */
  async updateRoomStatus(
    roomId: string,
    status: RoomStatus,
    staffId?: string
  ): Promise<{ updatedRoom: any; statusLog: RoomStatusLogDTO }> {
    const res = await fetch(`${resolveApiBaseUrl()}/rooms/${roomId}/status`, {
      method: 'PATCH',
      headers: getRequestHeaders(),
      body: JSON.stringify({ status, staffId }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to update room status', res.status);
    }

    return json.data;
  },

  /**
   * Finalize booking with concurrency locking
   */
  async createReservation(input: CreateReservationInput): Promise<any> {
    const res = await fetch(`${resolveApiBaseUrl()}/reservations`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(input),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Reservation request failed', res.status);
    }

    return json.data;
  },

  /**
   * Fetch all reservations for audit/history
   */
  async fetchReservations(): Promise<any[]> {
    const res = await fetch(`${resolveApiBaseUrl()}/reservations`, {
      headers: getRequestHeaders(),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to fetch reservations', res.status);
    }

    return json.data || [];
  },

  /**
   * Generate Invoice with base room rate, ancillary add-ons, and dynamic tax
   */
  async generateInvoice(input: CreateInvoiceInput): Promise<InvoiceDTO> {
    const res = await fetch(`${resolveApiBaseUrl()}/invoices/generate`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(input),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to generate invoice', res.status);
    }

    return json.data;
  },

  /**
   * Fetch invoice details by Invoice ID
   */
  async fetchInvoice(invoiceId: string): Promise<InvoiceDTO> {
    const res = await fetch(`${resolveApiBaseUrl()}/invoices/${invoiceId}`, {
      headers: getRequestHeaders(),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to fetch invoice', res.status);
    }

    return json.data;
  },

  /**
   * Fetch invoice details by Reservation ID
   */
  async fetchInvoiceByReservation(reservationId: string): Promise<InvoiceDTO> {
    const res = await fetch(`${resolveApiBaseUrl()}/invoices/reservation/${reservationId}`, {
      headers: getRequestHeaders(),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to fetch invoice for reservation', res.status);
    }

    return json.data;
  },

  /**
   * Process invoice payment and complete checkout
   */
  async payInvoice(invoiceId: string): Promise<InvoiceDTO> {
    const res = await fetch(`${resolveApiBaseUrl()}/invoices/${invoiceId}/pay`, {
      method: 'PATCH',
      headers: getRequestHeaders(),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to process payment', res.status);
    }

    return json.data;
  },

  /**
   * Send simulated Inbound OTA booking webhook
   */
  async sendOtaWebhook(payload: OTAInboundWebhookPayload): Promise<OTAWebhookResponse> {
    const res = await fetch(`${resolveApiBaseUrl()}/webhooks/ota`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'OTA Webhook processing failed', res.status);
    }

    return json.data;
  },

  /**
   * Fetch two-way channel synchronization audit logs
   */
  async fetchChannelLogs(limit: number = 30): Promise<ChannelSyncLogDTO[]> {
    const res = await fetch(`${resolveApiBaseUrl()}/webhooks/logs?limit=${limit}`, {
      headers: getRequestHeaders(),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to fetch channel logs', res.status);
    }

    return json.data || [];
  },

  /**
   * Fetch Direct vs OTA distribution metrics
   */
  async fetchChannelMetrics(): Promise<ChannelDistributionMetricsDTO> {
    const res = await fetch(`${resolveApiBaseUrl()}/webhooks/metrics`, {
      headers: getRequestHeaders(),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Failed to fetch channel metrics', res.status);
    }

    return json.data;
  },
};
