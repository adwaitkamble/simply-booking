import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ApiClient } from '../api/client';
import { BookingCard, BookingCardData } from '../components/BookingCard';
import { GoogleCalendarDatePickerModal } from '../components/GoogleCalendarDatePickerModal';
import { shadows } from '../theme';

interface BookingsScreenProps {
  onBack?: () => void;
  onSelectBooking?: (booking: BookingCardData) => void;
}

export const BookingsScreen: React.FC<BookingsScreenProps> = ({ onBack, onSelectBooking }) => {
  const [bookings, setBookings] = useState<BookingCardData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Date Filter State (Defaults to all dates)
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  const [showDatePickerModal, setShowDatePickerModal] = useState<boolean>(false);

  // Fetch Bookings from Postgres Backend
  const loadBookings = useCallback(async () => {
    try {
      setError(null);
      const data = await ApiClient.fetchBookings(startDate, endDate);
      setBookings(data);
    } catch (err: any) {
      console.warn('Failed to load bookings:', err);
      setError(err?.message || 'Failed to retrieve bookings from Postgres database');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    setLoading(true);
    loadBookings();
  }, [loadBookings]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const formatHeaderDateRange = () => {
    if (!startDate || !endDate) return 'All Dates';
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 'Select Date Range';

    const fmt = (d: Date) =>
      d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${fmt(s)} - ${fmt(e)}`;
  };

  return (
    <View style={styles.container}>
      {/* 1. Top Blue Header with Back Arrow */}
      <View style={styles.topHeader}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => onBack?.()}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bookings</Text>
          <TouchableOpacity
            style={styles.refreshHeaderBtn}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <Text style={styles.refreshIcon}>🔄</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Sub-Header Blue Card: Select Date Range Dropdown */}
        <View style={styles.dateFilterCard}>
          <Text style={styles.dateFilterCardLabel}>FILTER BY DATE RANGE</Text>
          <TouchableOpacity
            style={styles.dateDropdownBtn}
            onPress={() => setShowDatePickerModal(true)}
            activeOpacity={0.85}
          >
            <View style={styles.dateDropdownLeft}>
              <Text style={styles.calendarIcon}>📅</Text>
              <Text style={styles.dateRangeText}>{formatHeaderDateRange()}</Text>
            </View>
            <Text style={styles.dropdownChevron}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Main List Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066FF" />
          <Text style={styles.loadingText}>Fetching bookings from Postgres database...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadBookings}>
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              onPressView={(b) => onSelectBooking?.(b)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#0066FF']}
              tintColor="#0066FF"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No Bookings Found</Text>
              <Text style={styles.emptySub}>
                No bookings overlap with the selected date range ({formatHeaderDateRange()}).
              </Text>
            </View>
          }
        />
      )}

      {/* Date Range Picker Modal */}
      <GoogleCalendarDatePickerModal
        visible={showDatePickerModal}
        checkIn={startDate || new Date().toISOString().slice(0, 10)}
        checkOut={endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
        onClose={() => setShowDatePickerModal(false)}
        onApply={(newIn, newOut) => {
          setStartDate(newIn);
          setEndDate(newOut);
          setShowDatePickerModal(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // 1. Top Blue Header
  topHeader: {
    backgroundColor: '#0066FF',
    paddingTop: Platform.OS === 'ios' ? 48 : 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  refreshHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 16,
  },

  // 2. Sub-Header Blue Card
  dateFilterCard: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    padding: 12,
  },
  dateFilterCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#93C5FD',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dateDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dateDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarIcon: {
    fontSize: 14,
  },
  dateRangeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  dropdownChevron: {
    fontSize: 10,
    color: '#64748B',
  },

  // List & State Containers
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
});
