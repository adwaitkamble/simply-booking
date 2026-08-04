import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { ApiClient, AvailableRoomItem } from '../api/client';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { StyledInput } from '../components/StyledInput';
import { Badge } from '../components/Badge';
import { Header } from '../components/Header';
import { colors, typography, borderRadius, shadows } from '../theme';

interface CheckoutScreenProps {
  room: AvailableRoomItem;
  initialCheckIn: string;
  initialCheckOut: string;
  onBack: () => void;
  onBookingSuccess: () => void;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  room,
  initialCheckIn,
  initialCheckOut,
  onBack,
  onBookingSuccess,
}) => {
  const [guestId, setGuestId] = useState('');
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Compute approximate nights & price
  const calculateTotal = () => {
    try {
      const d1 = new Date(checkIn);
      const d2 = new Date(checkOut);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const basePrice = room.roomCategory?.basePrice || 100;
      return { nights: diffDays, total: diffDays * basePrice };
    } catch {
      return { nights: 1, total: room.roomCategory?.basePrice || 100 };
    }
  };

  const { nights, total } = calculateTotal();

  const handleBooking = async () => {
    if (!guestId.trim()) {
      setGeneralError('Guest UUID is required to complete reservation');
      return;
    }

    try {
      setSubmitting(true);
      setConflictError(null);
      setGeneralError(null);
      setSuccessData(null);

      const checkInIso = checkIn.includes('T') ? checkIn : `${checkIn}T14:00:00.000Z`;
      const checkOutIso = checkOut.includes('T') ? checkOut : `${checkOut}T10:00:00.000Z`;

      const result = await ApiClient.createReservation({
        guestId: guestId.trim(),
        roomId: room.id,
        checkIn: checkInIso,
        checkOut: checkOutIso,
        totalAmount: total,
        status: 'Confirmed',
      });

      setSuccessData(result);
    } catch (err: any) {
      if (err.statusCode === 409) {
        setConflictError(
          err.message || 'Room is no longer available for these dates (Concurrency Lock Held)'
        );
      } else {
        setGeneralError(err.message || 'Failed to complete booking request');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Finalize Reservation"
        subtitle="ACID-Compliant Booking Engine"
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Floating Toast Notification: 201 Created */}
        {successData ? (
          <View style={styles.successToast}>
            <View style={styles.toastIconCircle}>
              <Text style={styles.toastIconText}>✓</Text>
            </View>
            <View style={styles.toastContent}>
              <Text style={styles.toastTitle}>[201 CREATED] Reservation Confirmed</Text>
              <Text style={styles.toastMessage}>
                Recorded in PostgreSQL with row-level transaction integrity.
              </Text>
              <View style={styles.toastDivider} />
              <Text style={styles.toastDetail}>
                <Text style={styles.toastLabel}>Reservation ID: </Text>
                {successData.id}
              </Text>
              <Text style={styles.toastDetail}>
                <Text style={styles.toastLabel}>Guest: </Text>
                {successData.guest?.name || guestId}
              </Text>
              <Text style={styles.toastDetail}>
                <Text style={styles.toastLabel}>Status: </Text>
                {successData.status}
              </Text>
              <Text style={styles.toastDetail}>
                <Text style={styles.toastLabel}>Total Charged: </Text>
                ₹{Number(successData.totalAmount).toLocaleString('en-IN')}
              </Text>

              {/* Google Calendar Sync Indicator */}
              <View style={styles.calSuccessBanner}>
                <Text style={styles.calSuccessText}>📅 Synced to Management Google Calendar</Text>
              </View>
            </View>

            <View style={styles.toastButtonRow}>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://calendar.google.com')}
                style={styles.calViewButton}
                activeOpacity={0.8}
              >
                <Text style={styles.calViewButtonText}>Open in Google Calendar ↗</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onBookingSuccess}
                style={styles.toastReturnButton}
                activeOpacity={0.8}
              >
                <Text style={styles.toastReturnText}>Return to Inventory</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Floating Toast Notification: 409 Concurrency Conflict */}
        {conflictError ? (
          <View style={styles.conflictToast}>
            <View style={styles.conflictIconCircle}>
              <Text style={styles.conflictIconText}>✕</Text>
            </View>
            <View style={styles.toastContent}>
              <Text style={styles.conflictTitle}>[409 CONFLICT] Double-Booking Prevented</Text>
              <Text style={styles.conflictMessage}>{conflictError}</Text>
              <Text style={styles.conflictSub}>
                The database concurrency lock (`SELECT FOR UPDATE`) serialized this request and rejected collision to protect Room {room.roomNumber}.
              </Text>
            </View>
            <TouchableOpacity
              onPress={onBack}
              style={styles.conflictActionBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.conflictActionText}>Select Different Room / Dates</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* General Error Banner */}
        {generalError ? (
          <View style={styles.generalErrorBanner}>
            <Text style={styles.generalErrorTitle}>Booking Request Failed</Text>
            <Text style={styles.generalErrorText}>{generalError}</Text>
          </View>
        ) : null}

        {/* Digital Receipt / Folio Breakdown Card */}
        <Card style={styles.receiptCard}>
          <View style={styles.receiptHeader}>
            <View>
              <Text style={styles.receiptBrand}>THE ROYAL MARATHA RESORT • PUNE</Text>
              <Text style={styles.receiptTitle}>Digital Folio & Stay Details</Text>
            </View>
            <Badge label={`ROOM ${room.roomNumber}`} variant="dark" />
          </View>

          <View style={styles.receiptDividerDashed} />

          {/* Room Details */}
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Room Category</Text>
            <Text style={styles.receiptValue}>{room.roomCategory?.name}</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Location</Text>
            <Text style={styles.receiptValue}>
              {room.roomCategory?.property?.name || 'The Royal Maratha Resort, Pune'}
            </Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Base Nightly Rate</Text>
            <Text style={styles.receiptValue}>
              ₹{Number(room.roomCategory?.basePrice || 0).toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Duration</Text>
            <Text style={styles.receiptValue}>{nights} Nights</Text>
          </View>

          <View style={styles.receiptDividerSolid} />

          {/* Total Row */}
          <View style={styles.receiptTotalRow}>
            <Text style={styles.receiptTotalLabel}>Calculated Amount</Text>
            <Text style={styles.receiptTotalValue}>₹{total.toLocaleString('en-IN')}</Text>
          </View>
        </Card>

        {/* Guest & Reservation Input Form (Visible if not already confirmed) */}
        {!successData ? (
          <Card style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <View style={styles.formStepBadge}>
                <Text style={styles.formStepText}>2</Text>
              </View>
              <View>
                <Text style={styles.formTitle}>Guest & Stay Parameters</Text>
                <Text style={styles.formSub}>Assign reservation to guest record</Text>
              </View>
            </View>

            <StyledInput
              label="Guest UUID (PostgreSQL ID)"
              value={guestId}
              onChangeText={setGuestId}
              placeholder="e.g. a09791e1-6537-4ba7-b9d8-3d8259497d0b"
            />

            <View style={styles.formDateRow}>
              <View style={styles.flex1}>
                <StyledInput
                  label="Check-In"
                  value={checkIn}
                  onChangeText={setCheckIn}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={styles.dateSpacer} />
              <View style={styles.flex1}>
                <StyledInput
                  label="Check-Out"
                  value={checkOut}
                  onChangeText={setCheckOut}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>
          </Card>
        ) : null}
      </ScrollView>

      {/* Full-Width Fixed Bottom Checkout CTA */}
      {!successData ? (
        <View style={styles.bottomBar}>
          <View style={styles.bottomSummary}>
            <Text style={styles.bottomLabel}>Total Folio</Text>
            <Text style={styles.bottomPrice}>₹{total.toLocaleString('en-IN')}</Text>
          </View>
          <PrimaryButton
            title={submitting ? 'Acquiring Lock...' : 'Pay & Complete Checkout'}
            onPress={handleBooking}
            loading={submitting}
            variant="primary"
            size="lg"
            style={styles.checkoutBtn}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  // 201 Success Floating Toast
  successToast: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 16,
    ...shadows.cardHover,
  },
  toastIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  toastIconText: {
    color: colors.textWhite,
    fontSize: 18,
    fontWeight: '900',
  },
  toastContent: {
    marginBottom: 12,
  },
  toastTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textWhite,
    marginBottom: 4,
  },
  toastMessage: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
    marginBottom: 8,
  },
  toastDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginVertical: 8,
  },
  toastDetail: {
    fontSize: 12,
    color: colors.textWhite,
    marginBottom: 3,
  },
  toastLabel: {
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  calSuccessBanner: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  calSuccessText: {
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: '800',
  },
  toastButtonRow: {
    flexDirection: 'column',
    gap: 8,
  },
  calViewButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  calViewButtonText: {
    color: colors.textWhite,
    fontWeight: '800',
    fontSize: 13,
  },
  toastReturnButton: {
    backgroundColor: colors.textWhite,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toastReturnText: {
    color: colors.successDark,
    fontWeight: '800',
    fontSize: 13,
  },
  // 409 Conflict Floating Toast
  conflictToast: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 16,
    ...shadows.cardHover,
  },
  conflictIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  conflictIconText: {
    color: colors.textWhite,
    fontSize: 18,
    fontWeight: '900',
  },
  conflictTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textWhite,
    marginBottom: 4,
  },
  conflictMessage: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textWhite,
    marginBottom: 4,
  },
  conflictSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 16,
  },
  conflictActionBtn: {
    backgroundColor: colors.textWhite,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  conflictActionText: {
    color: colors.errorDark,
    fontWeight: '800',
    fontSize: 13,
  },
  generalErrorBanner: {
    backgroundColor: colors.errorLight,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 12,
    marginBottom: 14,
  },
  generalErrorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.errorDark,
  },
  generalErrorText: {
    fontSize: 11,
    color: colors.errorDark,
    marginTop: 2,
  },
  // Digital Receipt Card
  receiptCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 16,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  receiptBrand: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1,
  },
  receiptTitle: {
    ...typography.h2,
    fontSize: 16,
    color: colors.primary,
    marginTop: 2,
  },
  receiptDividerDashed: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  receiptValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  receiptDividerSolid: {
    height: 1.5,
    backgroundColor: colors.borderDark,
    marginTop: 6,
    marginBottom: 12,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  receiptTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  receiptTotalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  // Form Card
  formCard: {
    marginBottom: 16,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  formStepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  formStepText: {
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: '800',
  },
  formTitle: {
    ...typography.h3,
  },
  formSub: {
    ...typography.bodySmall,
  },
  formDateRow: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  dateSpacer: {
    width: 12,
  },
  // Full Width Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.modal,
  },
  bottomSummary: {
    flex: 0.45,
  },
  bottomLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  bottomPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  checkoutBtn: {
    flex: 0.55,
  },
});
