import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { shadows } from '../theme';
import { sendWhatsAppConfirmation } from '../utils/whatsapp';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 3px 8px rgba(15, 23, 42, 0.05)' as any }
  : {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    };

export interface BookingCardData {
  id: string;
  bookingId: string;
  roomNameAndPlan: string;
  guestName: string;
  guestPhone: string;
  lastUpdatedBy: string;
  lastUpdatedTimestamp: string;
  counts: {
    rooms: number;
    children: number;
    adults: number;
  };
  dates: {
    checkIn: string;
    checkOut: string;
    rawCheckIn?: string;
    rawCheckOut?: string;
  };
  financials: {
    totalAmount: number;
    advancePaid: number;
    balanceAmount: number;
  };
  status?: string;
}

interface BookingCardProps {
  booking: BookingCardData;
  onPressView?: (booking: BookingCardData) => void;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, onPressView }) => {
  const safeBooking = booking || ({} as BookingCardData);
  const {
    bookingId = '#—',
    roomNameAndPlan = 'Room not assigned',
    guestName = 'Walk-in Guest',
    guestPhone = '',
    lastUpdatedBy = 'Front Desk',
    lastUpdatedTimestamp = 'Not available',
  } = safeBooking;
  const counts = safeBooking.counts || { rooms: 1, children: 0, adults: 1 };
  const dates = safeBooking.dates || { checkIn: 'Not set', checkOut: 'Not set' };
  const financials = safeBooking.financials || {
    totalAmount: 0,
    advancePaid: 0,
    balanceAmount: 0,
  };

  return (
    <View style={styles.cardContainer}>
      {/* 1. Top Row: Light Blue Pill Badge + Eye Icon */}
      <View style={styles.topRow}>
        <View style={styles.roomPillBadge}>
          <Text style={styles.bedIcon}>🛏️</Text>
          <Text style={styles.roomNameText}>{roomNameAndPlan}</Text>
          <Text style={styles.bookingIdText}>{bookingId}</Text>
        </View>

        <View style={styles.actionBtnsRow}>
          <TouchableOpacity
            style={styles.waBtn}
            onPress={() => {
              sendWhatsAppConfirmation({
                guestName,
                guestPhone,
                roomName: roomNameAndPlan,
                checkIn: dates.checkIn,
                checkOut: dates.checkOut,
                totalAmount: financials.totalAmount,
                advancePaid: financials.advancePaid,
                balanceAmount: financials.balanceAmount,
                bookingId,
              });
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.waBtnText}>💬 WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => onPressView?.(booking)}
            activeOpacity={0.7}
          >
            <Text style={styles.eyeIconText}>👁️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Guest Details & Last Updated */}
      <View style={styles.guestRow}>
        <View style={styles.guestInfoCol}>
          <Text style={styles.guestNameText}>{guestName}</Text>
          <Text style={styles.guestPhoneText}>{guestPhone}</Text>
        </View>

        <View style={styles.lastUpdatedCol}>
          <Text style={styles.lastUpdatedText}>
            Updated by {lastUpdatedBy || 'Front Desk'}
          </Text>
          <Text style={styles.lastUpdatedTimeText}>
            {lastUpdatedTimestamp}
          </Text>
        </View>
      </View>

      {/* 3. Occupancy Pills & Dates */}
      <View style={styles.middleRow}>
        {/* Occupancy Counts Pills */}
        <View style={styles.countsContainer}>
          <View style={styles.countPill}>
            <Text style={styles.countIcon}>🏨</Text>
            <Text style={styles.countText}>{counts.rooms} Room</Text>
          </View>

          <View style={styles.countPill}>
            <Text style={styles.countIcon}>👶</Text>
            <Text style={styles.countText}>{counts.children} Child</Text>
          </View>

          <View style={styles.countPill}>
            <Text style={styles.countIcon}>👤</Text>
            <Text style={styles.countText}>{counts.adults} Adults</Text>
          </View>
        </View>

        {/* CheckIn / CheckOut Date Stacked Pills */}
        <View style={styles.datesContainer}>
          <View style={styles.datePill}>
            <Text style={styles.dateLabelText}>In:</Text>
            <Text style={styles.dateValText}>{dates.checkIn}</Text>
          </View>

          <View style={styles.datePill}>
            <Text style={styles.dateLabelText}>Out:</Text>
            <Text style={styles.dateValText}>{dates.checkOut}</Text>
          </View>
        </View>
      </View>

      {/* 4. Financial Footer */}
      <View style={styles.financialFooter}>
        <View style={styles.finCol}>
          <Text style={styles.finLabel}>Total Amount</Text>
          <Text style={styles.totalText}>
            ₹{Number(financials.totalAmount).toLocaleString('en-IN')}
          </Text>
        </View>

        <View style={styles.finDivider} />

        <View style={styles.finCol}>
          <Text style={styles.finLabel}>Advance Paid</Text>
          <Text style={styles.advanceText}>
            ₹{Number(financials.advancePaid).toLocaleString('en-IN')}
          </Text>
        </View>

        <View style={styles.finDivider} />

        <View style={styles.finCol}>
          <Text style={styles.finLabel}>Balance Due</Text>
          <Text style={styles.balanceText}>
            ₹{Number(financials.balanceAmount).toLocaleString('en-IN')}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(shadows?.card || cardShadow),
  },

  // 1. Top Row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  roomPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    flex: 1,
    marginRight: 10,
  },
  bedIcon: {
    fontSize: 13,
  },
  roomNameText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0066FF',
  },
  bookingIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  actionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  waBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  eyeBtn: {
    padding: 4,
  },
  eyeIconText: {
    fontSize: 18,
  },

  // 2. Guest Row
  guestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  guestInfoCol: {
    flex: 1,
  },
  guestNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  guestPhoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  lastUpdatedCol: {
    alignItems: 'flex-end',
  },
  lastUpdatedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  lastUpdatedTimeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },

  // 3. Middle Row
  middleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginBottom: 12,
  },
  countsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  countIcon: {
    fontSize: 11,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  datesContainer: {
    gap: 4,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  dateValText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },

  // 4. Financial Footer
  financialFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  finCol: {
    flex: 1,
    alignItems: 'center',
  },
  finLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  totalText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#16A34A',
  },
  advanceText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#D97706',
  },
  balanceText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#DC2626',
  },
  finDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
});
