import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, shadows } from '../theme';
import {
  STATUS_COLORS,
  buildReport,
  buildReportHtml,
  inr,
  ddmmyyyy,
} from '../utils/bookingReport';

interface BookingReportScreenProps {
  onBack?: () => void;
}

type PeriodId = '30d' | '90d' | '12m' | 'all';

const PERIODS: { id: PeriodId; label: string; days: number | null }[] = [
  { id: '30d', label: '30 Days', days: 30 },
  { id: '90d', label: '90 Days', days: 90 },
  { id: '12m', label: '12 Months', days: 365 },
  { id: 'all', label: 'All Time', days: null },
];


/** Vertical bars — revenue per month. */
const ColumnChart: React.FC<{ data: { label: string; revenue: number }[] }> = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  return (
    <View style={styles.columnChart}>
      {data.map((d) => (
        <View key={d.label} style={styles.columnWrap}>
          <Text style={styles.columnValue} numberOfLines={1}>
            {d.revenue >= 1000 ? `${Math.round(d.revenue / 1000)}k` : Math.round(d.revenue)}
          </Text>
          <View style={styles.columnTrack}>
            <View
              style={[
                styles.columnFill,
                { height: `${Math.max(4, (d.revenue / max) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.columnLabel} numberOfLines={1}>
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  );
};

/** Horizontal bars — used for category, room and status breakdowns. */
const BarList: React.FC<{
  data: { label: string; value: number; caption?: string; color?: string }[];
}> = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View>
      {data.map((d) => (
        <View key={d.label} style={styles.barRow}>
          <View style={styles.barHeader}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {d.label}
            </Text>
            <Text style={styles.barCaption}>{d.caption}</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.max(3, (d.value / max) * 100)}%`,
                  backgroundColor: d.color || colors.accent,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
};


export const BookingReportScreen: React.FC<BookingReportScreenProps> = ({ onBack }) => {
  const { property } = useAuth();
  const [reservations, setReservations] = useState<any[]>([]);
  const [period, setPeriod] = useState<PeriodId>('90d');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await ApiClient.fetchReservations();
      setReservations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load booking data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  const periodConfig = PERIODS.find((p) => p.id === period) || PERIODS[1];
  const report = useMemo(
    () => buildReport(reservations, periodConfig.days),
    [reservations, periodConfig.days]
  );

  const notify = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      const html = buildReportHtml(
        report,
        property?.name || 'Your Hotel',
        periodConfig.label === 'All Time' ? 'All Time' : `Last ${periodConfig.label}`
      );
      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Booking Report',
          UTI: 'com.adobe.pdf',
        });
      } else {
        notify('Report ready', `Saved to:\n${uri}`);
      }
    } catch (err: any) {
      notify('Export failed', err?.message || 'Could not generate the PDF report.');
    } finally {
      setIsExporting(false);
    }
  };

  const t = report.totals;

  const kpis: { label: string; value: string; tone?: string }[] = [
    { label: 'Total Bookings', value: String(t.bookings) },
    { label: 'Room Nights', value: String(t.roomNights) },
    { label: 'Gross Revenue', value: inr(t.revenue), tone: colors.success },
    { label: 'Advance Collected', value: inr(t.advance) },
    { label: 'Balance Due', value: inr(t.balance), tone: colors.error },
    { label: 'Avg Nightly Rate', value: inr(t.adr) },
    { label: 'Avg Stay', value: `${t.avgStay.toFixed(1)} nights` },
    { label: 'Cancelled', value: `${t.cancelled} (${t.cancelRate.toFixed(0)}%)` },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => onBack?.()} activeOpacity={0.7}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>Booking Report</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {property?.name || 'Your Hotel'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={handleDownload}
            disabled={isExporting || isLoading}
            activeOpacity={0.8}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.downloadBtnText}>⬇ PDF</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.periodChip, period === p.id && styles.periodChipActive]}
              onPress={() => setPeriod(p.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.periodText, period === p.id && styles.periodTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading && !isRefreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.centerText}>Building your report...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.centerText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                load();
              }}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
        >
          <View style={styles.kpiGrid}>
            {kpis.map((k) => (
              <View key={k.label} style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{k.label.toUpperCase()}</Text>
                <Text style={[styles.kpiValue, k.tone ? { color: k.tone } : null]}>{k.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Revenue by Month</Text>
            {report.byMonth.length ? (
              <ColumnChart data={report.byMonth} />
            ) : (
              <Text style={styles.emptyNote}>No bookings in this period.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Revenue by Room Category</Text>
            {report.byCategory.length ? (
              <BarList
                data={report.byCategory.map((c) => ({
                  label: c.label,
                  value: c.revenue,
                  caption: `${inr(c.revenue)} · ${c.count}`,
                }))}
              />
            ) : (
              <Text style={styles.emptyNote}>No bookings in this period.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Rooms by Revenue</Text>
            {report.byRoom.length ? (
              <BarList
                data={report.byRoom.map((r) => ({
                  label: r.label,
                  value: r.revenue,
                  caption: `${inr(r.revenue)} · ${r.count}`,
                  color: colors.primaryMuted,
                }))}
              />
            ) : (
              <Text style={styles.emptyNote}>No bookings in this period.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Booking Status</Text>
            {report.statusCounts.length ? (
              <BarList
                data={report.statusCounts.map((s) => ({
                  label: s.label,
                  value: s.count,
                  caption: String(s.count),
                  color: STATUS_COLORS[s.label],
                }))}
              />
            ) : (
              <Text style={styles.emptyNote}>No bookings in this period.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bookings ({report.rows.length})</Text>
            {report.rows.length ? (
              report.rows.slice(0, 50).map((r) => (
                <View key={r.id} style={styles.bookingRow}>
                  <View style={styles.bookingMain}>
                    <Text style={styles.bookingGuest} numberOfLines={1}>
                      {r.guestName}
                    </Text>
                    <Text style={styles.bookingMeta} numberOfLines={1}>
                      {r.category} · Room {r.roomNumber}
                    </Text>
                    <Text style={styles.bookingMeta}>
                      {ddmmyyyy(r.checkIn)} → {ddmmyyyy(r.checkOut)} · {r.nights}N
                    </Text>
                  </View>
                  <View style={styles.bookingSide}>
                    <Text style={styles.bookingTotal}>{inr(r.total)}</Text>
                    {r.balance > 0 ? (
                      <Text style={styles.bookingBalance}>Due {inr(r.balance)}</Text>
                    ) : (
                      <Text style={styles.bookingPaid}>Paid</Text>
                    )}
                    <Text
                      style={[
                        styles.bookingStatus,
                        { color: STATUS_COLORS[r.status] || colors.textSecondary },
                      ]}
                    >
                      {r.status}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyNote}>No bookings in this period.</Text>
            )}
            {report.rows.length > 50 ? (
              <Text style={styles.emptyNote}>
                Showing the 50 most recent. The PDF contains all {report.rows.length}.
              </Text>
            ) : null}
          </View>

          <Text style={styles.footNote}>
            Revenue figures exclude cancelled bookings. Day and month ranges cover
            past stays only — choose All Time to include upcoming bookings.
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.accentDark,
    paddingTop: Platform.OS === 'web' ? 20 : 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: '#ffffff', fontWeight: '700' },
  headerTitleCol: { flex: 1, marginLeft: 4 },
  headerTitle: { fontSize: 19, fontWeight: '800', color: '#ffffff' },
  headerSubtitle: { fontSize: 12, color: '#DBEAFE', marginTop: 1 },
  downloadBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 68,
    alignItems: 'center',
  },
  downloadBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  periodRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  periodChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  periodChipActive: { backgroundColor: '#ffffff' },
  periodText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  periodTextActive: { color: colors.accentDark },

  scrollContent: { padding: 12, paddingBottom: 40 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  kpiLabel: { fontSize: 9, letterSpacing: 0.6, color: colors.textSecondary, fontWeight: '700' },
  kpiValue: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginTop: 4 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  emptyNote: { fontSize: 12, color: colors.textMuted, paddingVertical: 6 },
  footNote: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 16 },

  columnChart: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 6 },
  columnWrap: { flex: 1, alignItems: 'center', height: '100%' },
  columnValue: { fontSize: 8, color: colors.textSecondary, marginBottom: 2 },
  columnTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  columnFill: { width: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  columnLabel: { fontSize: 8, color: colors.textSecondary, marginTop: 4 },

  barRow: { marginBottom: 11 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { fontSize: 12, fontWeight: '600', color: colors.textPrimary, flex: 1, marginRight: 8 },
  barCaption: { fontSize: 11, color: colors.textSecondary },
  barTrack: { height: 8, backgroundColor: colors.surfaceSubtle, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },

  bookingRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  bookingMain: { flex: 1, paddingRight: 10 },
  bookingGuest: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  bookingMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  bookingSide: { alignItems: 'flex-end' },
  bookingTotal: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  bookingBalance: { fontSize: 11, color: colors.error, marginTop: 1 },
  bookingPaid: { fontSize: 11, color: colors.success, marginTop: 1 },
  bookingStatus: { fontSize: 10, fontWeight: '800', marginTop: 2 },

  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  centerText: { marginTop: 12, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  errorIcon: { fontSize: 34 },
  retryBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: { color: '#ffffff', fontWeight: '700' },
});
