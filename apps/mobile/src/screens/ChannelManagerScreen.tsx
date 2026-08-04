import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import io from 'socket.io-client';
import { ApiClient } from '../api/client';
import type {
  ChannelDistributionMetricsDTO,
  ChannelSyncLogDTO,
  OTAInboundWebhookPayload,
} from '@hotel-pms/types';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { Badge } from '../components/Badge';
import { Header } from '../components/Header';
import { colors, typography, borderRadius, shadows } from '../theme';

interface ChannelManagerScreenProps {
  onBack?: () => void;
}

export const ChannelManagerScreen: React.FC<ChannelManagerScreenProps> = ({ onBack }) => {
  const [metrics, setMetrics] = useState<ChannelDistributionMetricsDTO | null>(null);
  const [logs, setLogs] = useState<ChannelSyncLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [lastActionStatus, setLastActionStatus] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [fetchedMetrics, fetchedLogs] = await Promise.all([
        ApiClient.fetchChannelMetrics().catch(() => null),
        ApiClient.fetchChannelLogs(25).catch(() => []),
      ]);

      if (fetchedMetrics) {
        setMetrics(fetchedMetrics);
      }
      setLogs(fetchedLogs);
    } catch (err: any) {
      console.warn('Failed to load channel data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Socket.io Real-Time connection
    const socket = io(ApiClient.getSocketUrl(), {
      transports: ['websocket'],
    });

    socket.on('channelLogAdded', (newLog: ChannelSyncLogDTO) => {
      setLogs((prev) => [newLog, ...prev.filter((l) => l.id !== newLog.id)].slice(0, 30));
      ApiClient.fetchChannelMetrics()
        .then(setMetrics)
        .catch(() => {});
    });

    socket.on('ariUpdated', () => {
      loadData();
    });

    return () => {
      socket.disconnect();
    };
  }, [loadData]);

  const handleSimulateOTABooking = async () => {
    setSimulating(true);
    setLastActionStatus('Simulating incoming Expedia webhook...');
    try {
      // 1. Fetch an available room
      const availableRooms = await ApiClient.fetchAvailableRooms(
        '2027-04-10',
        '2027-04-14'
      );

      if (availableRooms.length === 0) {
        setLastActionStatus('No available rooms for mock dates 2027-04-10.');
        setSimulating(false);
        return;
      }

      const targetRoom = availableRooms[0];
      const mockRef = `MMT-${Math.floor(100000 + Math.random() * 900000)}`;

      const payload: OTAInboundWebhookPayload = {
        channel: 'MakeMyTrip',
        otaReservationId: mockRef,
        guest: {
          name: 'Vikram Malhotra (MakeMyTrip)',
          email: `vikram.${Date.now()}@makemytrip.in`,
          phone: '+91 98220 44556',
        },
        roomId: targetRoom.id,
        checkIn: '2027-04-10T14:00:00.000Z',
        checkOut: '2027-04-14T10:00:00.000Z',
        totalAmount: (targetRoom.roomCategory?.basePrice || 4500) * 4,
      };

      await ApiClient.sendOtaWebhook(payload);
      setLastActionStatus(`✅ Inbound Webhook Processed! Ref #${mockRef} -> Room ${targetRoom.roomNumber}`);
      loadData();
    } catch (err: any) {
      setLastActionStatus(`❌ Simulation Error: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="CRS & Channel Manager"
        subtitle="Two-Way ARI Sync & OTA Webhook Pipeline"
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Action Notification Box */}
        {lastActionStatus ? (
          <View style={styles.notificationCard}>
            <Text style={styles.notificationText}>{lastActionStatus}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>Syncing channel data...</Text>
          </View>
        ) : (
          <>
            {/* Distribution Metrics Card */}
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Channel Distribution Metrics</Text>
                <Badge label="LIVE SYNC" variant="success" size="sm" dot />
              </View>

              {/* 3 Metric Stats */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>TOTAL BOOKINGS</Text>
                  <Text style={styles.metricValue}>{metrics?.totalBookings ?? 0}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>DIRECT ENGINE</Text>
                  <Text style={styles.metricValue}>
                    {metrics?.directBookings ?? 0}{' '}
                    <Text style={styles.metricPercent}>({metrics?.directPercentage ?? 0}%)</Text>
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>OTA CHANNELS</Text>
                  <Text style={styles.metricValue}>
                    {metrics?.otaBookings ?? 0}{' '}
                    <Text style={styles.metricPercent}>({metrics?.otaPercentage ?? 0}%)</Text>
                  </Text>
                </View>
              </View>

              {/* Split Distribution Bar */}
              <View style={styles.distributionContainer}>
                <View style={styles.distLabelRow}>
                  <Text style={styles.distLabel}>Direct vs OTA Share</Text>
                  <Text style={styles.distRatio}>
                    {metrics?.directPercentage ?? 50}% / {metrics?.otaPercentage ?? 50}%
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFillDirect,
                      { width: `${metrics?.directPercentage ?? 50}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.barFillOta,
                      { width: `${metrics?.otaPercentage ?? 50}%` },
                    ]}
                  />
                </View>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                    <Text style={styles.legendText}>Direct Engine</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.purple }]} />
                    <Text style={styles.legendText}>External OTAs</Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Revenue Row */}
              <View style={styles.revenueRow}>
                <View>
                  <Text style={styles.revenueLabel}>Direct Revenue</Text>
                  <Text style={styles.revenueValue}>
                    ₹{Number(metrics?.directRevenue || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View>
                  <Text style={styles.revenueLabel}>OTA Revenue</Text>
                  <Text style={styles.revenueValue}>
                    ₹{Number(metrics?.otaRevenue || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View>
                  <Text style={styles.revenueLabel}>Total Volume</Text>
                  <Text style={[styles.revenueValue, styles.totalHighlight]}>
                    ₹{Number(metrics?.totalRevenue || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Connected Distribution Channels Card */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Connected Distribution Channels</Text>
              <View style={styles.channelsGrid}>
                {[
                  { name: 'MakeMyTrip', code: 'MMT' },
                  { name: 'Goibibo', code: 'GOI' },
                  { name: 'Booking.com', code: 'BKD' },
                  { name: 'Agoda', code: 'AGD' },
                  { name: 'Airbnb', code: 'ABNB' },
                  { name: 'EaseMyTrip', code: 'EMT' },
                ].map((channel) => (
                  <View key={channel.name} style={styles.channelTile}>
                    <View style={styles.channelIconCircle}>
                      <Text style={styles.channelCodeText}>{channel.code}</Text>
                    </View>
                    <Text style={styles.channelName}>{channel.name}</Text>
                    <Badge label="ARI ACTIVE" variant="success" size="sm" dot />
                  </View>
                ))}
              </View>
            </Card>

            {/* Webhook Simulation Trigger Card */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>OTA Webhook Simulation Test</Text>
              <Text style={styles.helperText}>
                Inject a mock reservation payload into the ACID locking engine to test concurrent OTA inventory updates.
              </Text>
              <PrimaryButton
                title={simulating ? 'Simulating...' : '⚡ Simulate Incoming OTA Booking (Expedia)'}
                variant="dark"
                size="md"
                loading={simulating}
                onPress={handleSimulateOTABooking}
                style={styles.simulateBtn}
              />
            </Card>

            {/* Real-time Two-Way Sync Activity Feed Card */}
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Real-Time 2-Way Sync Feed</Text>
                <TouchableOpacity onPress={loadData} style={styles.refreshChip}>
                  <Text style={styles.refreshChipText}>↻ Refresh</Text>
                </TouchableOpacity>
              </View>

              {logs.length === 0 ? (
                <View style={styles.emptyFeed}>
                  <Text style={styles.emptyFeedText}>No synchronization events recorded yet.</Text>
                </View>
              ) : (
                logs.map((log) => (
                  <View
                    key={log.id}
                    style={[
                      styles.logCard,
                      log.direction === 'INBOUND' ? styles.inboundBorder : styles.outboundBorder,
                    ]}
                  >
                    <View style={styles.logHeader}>
                      <View style={styles.logBadges}>
                        <Badge
                          label={log.direction === 'INBOUND' ? '▲ INBOUND OTA' : '▼ OUTBOUND ARI'}
                          variant={log.direction === 'INBOUND' ? 'info' : 'purple'}
                          size="sm"
                        />
                        <Badge status={log.status} size="sm" />
                      </View>
                      <Text style={styles.logTime}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>

                    <Text style={styles.logChannelText}>
                      Channel: <Text style={styles.boldText}>{log.channel}</Text> • Event:{' '}
                      <Text style={styles.boldText}>{log.eventType}</Text>
                    </Text>

                    {log.details ? (
                      <Text style={styles.logMessage}>{log.details}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
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
    paddingBottom: 40,
  },
  notificationCard: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: borderRadius.md,
    padding: 12,
    marginBottom: 14,
  },
  notificationText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodySmall,
    marginTop: 8,
  },
  sectionCard: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.primary,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    padding: 10,
    borderRadius: borderRadius.md,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  metricPercent: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  distributionContainer: {
    marginBottom: 14,
  },
  distLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  distLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  distRatio: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFillDirect: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  barFillOta: {
    height: '100%',
    backgroundColor: colors.purple,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  revenueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  revenueLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  revenueValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
  totalHighlight: {
    color: colors.accent,
    fontWeight: '800',
  },
  channelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  channelTile: {
    width: '48%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    padding: 12,
    alignItems: 'center',
  },
  channelIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  channelCodeText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
  },
  channelName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6,
  },
  helperText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  simulateBtn: {
    marginTop: 4,
  },
  refreshChip: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  refreshChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyFeed: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyFeedText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  logCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  inboundBorder: {
    borderLeftColor: colors.accent,
  },
  outboundBorder: {
    borderLeftColor: colors.purple,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  logTime: {
    fontSize: 10,
    color: colors.textMuted,
  },
  logChannelText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  boldText: {
    fontWeight: '700',
    color: colors.primary,
  },
  logMessage: {
    fontSize: 11,
    color: colors.textPrimary,
    marginTop: 4,
  },
});
