/**
 * Domain enums for Hotel Property Management System
 */
export type RoomStatus = 'Clean' | 'Dirty' | 'Maintenance';

export const RoomStatus = {
  Clean: 'Clean' as RoomStatus,
  Dirty: 'Dirty' as RoomStatus,
  Maintenance: 'Maintenance' as RoomStatus,
};

export type ReservationStatus =
  | 'Pending'
  | 'Confirmed'
  | 'CheckedIn'
  | 'CheckedOut'
  | 'Cancelled';

export const ReservationStatus = {
  Pending: 'Pending' as ReservationStatus,
  Confirmed: 'Confirmed' as ReservationStatus,
  CheckedIn: 'CheckedIn' as ReservationStatus,
  CheckedOut: 'CheckedOut' as ReservationStatus,
  Cancelled: 'Cancelled' as ReservationStatus,
};

export type StaffRole = 'Housekeeper' | 'FrontDesk' | 'Manager';

export const StaffRole = {
  Housekeeper: 'Housekeeper' as StaffRole,
  FrontDesk: 'FrontDesk' as StaffRole,
  Manager: 'Manager' as StaffRole,
};

export type InvoiceStatus = 'Unpaid' | 'Paid' | 'Refunded';

export const InvoiceStatus = {
  Unpaid: 'Unpaid' as InvoiceStatus,
  Paid: 'Paid' as InvoiceStatus,
  Refunded: 'Refunded' as InvoiceStatus,
};

export type InvoiceItemCategory =
  | 'Room'
  | 'FoodAndBeverage'
  | 'Laundry'
  | 'Tax'
  | 'Other';

export const InvoiceItemCategory = {
  Room: 'Room' as InvoiceItemCategory,
  FoodAndBeverage: 'FoodAndBeverage' as InvoiceItemCategory,
  Laundry: 'Laundry' as InvoiceItemCategory,
  Tax: 'Tax' as InvoiceItemCategory,
  Other: 'Other' as InvoiceItemCategory,
};

export type OTAChannel =
  | 'MakeMyTrip'
  | 'Goibibo'
  | 'Expedia'
  | 'Booking.com'
  | 'Airbnb'
  | 'Agoda'
  | 'Direct';

export const OTAChannel = {
  MakeMyTrip: 'MakeMyTrip' as OTAChannel,
  Goibibo: 'Goibibo' as OTAChannel,
  Expedia: 'Expedia' as OTAChannel,
  BookingCom: 'Booking.com' as OTAChannel,
  Airbnb: 'Airbnb' as OTAChannel,
  Agoda: 'Agoda' as OTAChannel,
  Direct: 'Direct' as OTAChannel,
};

/**
 * Domain entity interfaces
 */
export interface ChainDTO {
  id: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  properties?: PropertyDTO[];
}

export type UserRole = 'Admin' | 'Staff';

export interface ActionPermissions {
  create: boolean;
  edit: boolean;
  view: boolean;
  delete: boolean;
  list: boolean;
}

export type ModulePermissions = Record<string, ActionPermissions>;

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  mobileNumber?: string | null;
  role: UserRole;
  isActive: boolean;
  permissions?: ModulePermissions | null;
  propertyId: string;
  property?: PropertyDTO;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PropertyDTO {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  currency: string;
  zipCode?: string | null;
  chainId: string;
  chain?: ChainDTO;
  users?: UserDTO[];
  roomCategories?: RoomCategoryDTO[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RegisterPayload {
  propertyName: string;
  name: string;
  email: string;
  password: string;
  country: string;
  currency?: string;
  mobileNumber?: string;
  city?: string;
  zipCode?: string;
  address?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface CreateTeamMemberPayload {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  isActive?: boolean;
  permissions?: ModulePermissions;
}

export interface UpdateTeamMemberPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  permissions?: ModulePermissions;
}

export interface AuthUserPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  permissions?: ModulePermissions | null;
  propertyId: string;
  propertyName: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: UserDTO;
  property: PropertyDTO;
  message?: string;
}

export interface RoomCategoryDTO {
  id: string;
  name: string;
  description?: string | null;
  basePrice: number;
  propertyId: string;
  property?: PropertyDTO;
  rooms?: RoomDTO[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface StaffDTO {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RoomStatusLogDTO {
  id: string;
  roomId: string;
  previousStatus: RoomStatus;
  newStatus: RoomStatus;
  changedAt: Date | string;
  turnoverDurationSeconds?: number | null;
  staffId?: string | null;
  staff?: StaffDTO | null;
}

export interface RoomDTO {
  id: string;
  roomNumber: string;
  pricePerNight?: number | null;
  roomSize?: string | null;
  status: RoomStatus;
  roomCategoryId: string;
  roomCategory?: RoomCategoryDTO;
  reservations?: ReservationDTO[];
  statusLogs?: RoomStatusLogDTO[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface GuestDTO {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string | null;
  pincode?: string | null;
  idNumber?: string | null;
  passportNumber?: string | null;
  dob?: Date | string | null;
  hostName?: string | null;
  hostPhone?: string | null;
  reservations?: ReservationDTO[];
  invoices?: InvoiceDTO[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ReservationDTO {
  id: string;
  guestId: string;
  guest?: GuestDTO;
  roomId: string;
  room?: RoomDTO;
  checkIn: Date | string;
  checkOut: Date | string;
  checkInTime?: string;
  checkOutTime?: string;
  adults?: number;
  children?: number;
  totalAmount: number;
  advancePaid?: number;
  notes?: string | null;
  status: ReservationStatus;
  invoices?: InvoiceDTO[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ReservationWithRelationsDTO extends ReservationDTO {
  guest: GuestDTO;
  room: RoomDTO & {
    roomCategory: RoomCategoryDTO & {
      property: PropertyDTO & {
        chain: ChainDTO;
      };
    };
  };
}

export interface InvoiceItemDTO {
  id: string;
  invoiceId: string;
  description: string;
  amount: number;
  quantity: number;
  category: InvoiceItemCategory;
  createdAt: Date | string;
}

export interface InvoiceDTO {
  id: string;
  reservationId: string;
  reservation?: ReservationDTO;
  guestId: string;
  guest?: GuestDTO;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  status: InvoiceStatus;
  items?: InvoiceItemDTO[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface InvoiceWithRelationsDTO extends InvoiceDTO {
  reservation: ReservationWithRelationsDTO;
  guest: GuestDTO;
  items: InvoiceItemDTO[];
}

/**
 * Input DTOs for Creation & Updates
 */
export interface CreateChainInput {
  name: string;
}

export interface CreatePropertyInput {
  name: string;
  address: string;
  city: string;
  country: string;
  chainId: string;
}

export interface CreateRoomCategoryInput {
  name: string;
  description?: string;
  basePrice: number;
  propertyId: string;
}

export interface CreateRoomInput {
  roomNumber: string;
  pricePerNight?: number;
  roomSize?: string;
  status?: RoomStatus;
  roomCategoryId: string;
}

export interface CreateGuestInput {
  name: string;
  email?: string;
  phone: string;
  address?: string;
  pincode?: string;
  idNumber?: string;
  passportNumber?: string;
  dob?: Date | string;
  hostName?: string;
  hostPhone?: string;
}

export interface CreateReservationInput {
  guestId?: string;
  guest?: CreateGuestInput;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  address?: string;
  pincode?: string;
  idNumber?: string;
  passportNumber?: string;
  dateOfBirth?: string;
  hostName?: string;
  roomId: string;
  checkIn: Date | string;
  checkOut: Date | string;
  checkInTime?: string;
  checkOutTime?: string;
  adults?: number;
  children?: number;
  totalAmount: number;
  advancePaid?: number;
  notes?: string;
  status?: ReservationStatus;
}

export interface UpdateRoomStatusInput {
  status: RoomStatus;
  staffId?: string;
}

export interface AncillaryItemInput {
  description: string;
  amount: number;
  quantity?: number;
  category?: InvoiceItemCategory;
}

export interface CreateInvoiceInput {
  reservationId: string;
  ancillaryItems?: AncillaryItemInput[];
}

export interface PayInvoiceInput {
  paymentMethod?: string;
}

/**
 * CRS & Channel Manager DTOs
 */
export interface OTAInboundWebhookPayload {
  channel: OTAChannel;
  otaReservationId: string;
  guest: {
    name: string;
    email: string;
    phone: string;
  };
  roomId: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
}

export interface OTAWebhookResponse {
  success: boolean;
  reservationId: string;
  otaReservationId: string;
  channel: OTAChannel;
  status: ReservationStatus;
  message: string;
}

export interface ARIUpdatePayload {
  roomId: string;
  roomNumber: string;
  propertyId?: string;
  eventType: 'ReservationCreated' | 'ReservationCancelled' | 'RoomStatusChanged';
  newStatus: string;
  availabilityChanged: boolean;
  timestamp: string;
  channelsNotified: string[];
  details?: string;
}

export interface ChannelSyncLogDTO {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  channel: string;
  eventType: string;
  status: 'SUCCESS' | 'CONFLICT_409' | 'ERROR';
  details: string;
  timestamp: string;
}

export interface ChannelDistributionMetricsDTO {
  totalBookings: number;
  directBookings: number;
  otaBookings: number;
  directPercentage: number;
  otaPercentage: number;
  totalRevenue: number;
  otaRevenue: number;
  directRevenue: number;
  channelBreakdown: Record<string, { count: number; revenue: number }>;
}

/**
 * Real-time event payloads
 */
export interface RoomStatusUpdatedPayload {
  roomId: string;
  roomNumber: string;
  previousStatus: RoomStatus;
  newStatus: RoomStatus;
  changedAt: string;
  turnoverDurationSeconds?: number | null;
  staffId?: string | null;
}
