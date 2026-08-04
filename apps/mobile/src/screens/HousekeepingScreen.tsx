import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import { ApiClient, HousekeepingRoomItem } from '../api/client';
import type { RoomStatus, RoomStatusUpdatedPayload } from '@hotel-pms/types';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { Badge } from '../components/Badge';
import { Header } from '../components/Header';
import { colors, typography, borderRadius, shadows } from '../theme';

interface HousekeepingScreenProps {
  onBack?: () => void;
}

export const HousekeepingScreen: React.FC<HousekeepingScreenProps> = ({ onBack }) => {
  const [rooms, setRooms] = useState<HousekeepingRoomItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [lastLiveEvent, setLastLiveEvent] = useState<RoomStatusUpdatedPayload | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | RoomStatus>('ALL');

  const loadHousekeepingRooms = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await ApiClient.fetchHousekeepingRooms();
      setRooms(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load housekeeping tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHousekeepingRooms();

    // Initialize Socket.io Real-Time Connection
    const socketUrl = ApiClient.getSocketUrl();
    const socket: Socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('⚡ [Mobile WebSocket] Connected to Real-Time Server');
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 [Mobile WebSocket] Disconnected from Real-Time Server');
      setSocketConnected(false);
    });

    // Real-Time Room Status Updated Listener
    socket.on('roomStatusUpdated', (payload: RoomStatusUpdatedPayload) => {
      console.log('📡 [Mobile WebSocket Event Received]:', payload);
      setLastLiveEvent(payload);

      setRooms((prevRooms) => {
        if (payload.newStatus === 'Clean') {
          // Instantly remove cleaned room from the dirty/turnover list without manual refresh
          return prevRooms.filter((r) => r.id !== payload.roomId);
        } else {
          // Update status if in list
          const exists = prevRooms.some((r) => r.id === payload.roomId);
          if (exists) {
            return prevRooms.map((r) =>
              r.id === payload.roomId ? { ...r, status: payload.newStatus } : r
            );
          }
          return prevRooms;
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleUpdateStatus = async (roomId: string, newStatus: RoomStatus) => {
    try {
      setUpdatingId(roomId);
      setError(null);
      await ApiClient.updateRoomStatus(roomId, newStatus);
    } catch (err: any) {
      setError(err.message || `Failed to update room to ${newStatus}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadHousekeepingRooms();
  };

  const filteredRooms = rooms.filter((r) => {
    if (statusFilter === 'ALL') return true;
    return r.status === statusFilter;
  });

  return (
    <View style={styles.container}>
      <Header
        title="Housekeeping Turnover"
        subtitle="Real-Time Status Trigger & Turnover Logs"
        onBack={onBack}
      />

      {/* Floating Sleek Real-Time WebSocket Toast */}
      {lastLiveEvent ? (
        <View style={styles.liveEventToast}>
          <View style={styles.liveEventDot} />
          <View style={styles.liveEventContent}>
            <Text style={styles.liveEventHeader}>REAL-TIME UPDATE RECEIVED</Text>
            <Text style={styles.liveEventText}>
              Room {lastLiveEvent.roomNumber}: {lastLiveEvent.previousStatus} ➔{' '}
              <Text style={styles.boldText}>{lastLiveEvent.newStatus}</Text>
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setLastLiveEvent(null)}
            style={styles.closeToastBtn}
          >
            <Text style={styles.closeToastText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Role & Connection Status Bar */}
        <Card style={styles.statusBarCard}>
          <View style={styles.statusRow}>
            <View style={styles.staffBadge}>
              <Text style={styles.staffRoleText}>STAFF PORTAL</Text>
              <Text style={styles.staffNameText}>Housekeeping Operative</Text>
            </View>

            <View style={styles.connectionBadge}>
              <View
                style={[
                  styles.socketDot,
                  socketConnected ? styles.socketOnline : styles.socketOffline,
                ]}
              />
              <Text
                style={[
                  styles.socketText,
                  socketConnected ? styles.socketTextOnline : styles.socketTextOffline,
                ]}
              >
                {socketConnected ? 'WS LIVE' : 'WS CONNECTING'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Filter Chips Bar */}
        <View style={styles.filterChipsRow}>
          {(['ALL', 'Dirty', 'Maintenance'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.chip,
                statusFilter === tab && styles.chipActive,
              ]}
              onPress={() => setStatusFilter(tab)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.chipText,
                  statusFilter === tab && styles.chipTextActive,
                ]}
              >
                {tab === 'ALL' ? `All (${rooms.length})` : tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Error Notification */}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Operation Failed</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Empty / All Rooms Clean State */}
        {!loading && filteredRooms.length === 0 && !error ? (
          <Card style={styles.allCleanCard}>
            <Text style={styles.allCleanIcon}>✨</Text>
            <Text style={styles.allCleanTitle}>All Rooms Are Clean</Text>
            <Text style={styles.allCleanSub}>
              Zero turnover backlog remaining in this category. Live WebSocket is active.
            </Text>
          </Card>
        ) : null}

        {/* Room Turnover Cards */}
        {filteredRooms.map((room) => {
          const isDirty = room.status === 'Dirty';
          const isMaintenance = room.status === 'Maintenance';
          const isBusy = updatingId === room.id;

          return (
            <Card
              key={room.id}
              style={[
                styles.roomCard,
                isDirty ? styles.dirtyBorder : undefined,
                isMaintenance ? styles.maintenanceBorder : undefined,
              ]}
            >
              {/* Top Operational Header */}
              <View style={styles.roomCardHeader}>
                <View>
                  <View style={styles.roomNumberContainer}>
                    <Text style={styles.roomPrefix}>ROOM</Text>
                    <Text style={styles.roomNumber}>{room.roomNumber}</Text>
                  </View>
                  <Text style={styles.roomCategoryName}>
                    {room.roomCategory?.name} • {room.roomCategory?.property?.name}
                  </Text>
                </View>
                <Badge status={room.status} dot size="md" />
              </View>

              {/* Status Log info if available */}
              {room.statusLogs && room.statusLogs.length > 0 ? (
                <View style={styles.logBox}>
                  <Text style={styles.logTitle}>Last Activity:</Text>
                  <Text style={styles.logText}>
                    {room.statusLogs[0].previousStatus} ➔ {room.statusLogs[0].newStatus} (
                    {new Date(room.statusLogs[0].changedAt).toLocaleTimeString()})
                  </Text>
                </View>
              ) : null}

              <View style={styles.cardDivider} />

              {/* High-Speed Operational Action Buttons */}
              <View style={styles.actionButtonsRow}>
                {isDirty && (
                  <PrimaryButton
                    title={isBusy ? 'Updating...' : '✓ Mark as Clean'}
                    onPress={() => handleUpdateStatus(room.id, 'Clean')}
                    loading={isBusy}
                    variant="success"
                    size="md"
                    style={styles.cleanButton}
                  />
                )}

                {isMaintenance && (
                  <PrimaryButton
                    title={isBusy ? 'Updating...' : '✓ Mark as Clean'}
                    onPress={() => handleUpdateStatus(room.id, 'Clean')}
                    loading={isBusy}
                    variant="success"
                    size="md"
                    style={styles.cleanButton}
                  />
                )}

                {/* Secondary status switchers */}
                <View style={styles.secondaryActions}>
                  {room.status !== 'Dirty' && (
                    <TouchableOpacity
                      onPress={() => handleUpdateStatus(room.id, 'Dirty')}
                      disabled={isBusy}
                      style={styles.secondaryChip}
                    >
                      <Text style={styles.secondaryChipText}>Flag Dirty</Text>
                    </TouchableOpacity>
                  )}

                  {room.status !== 'Maintenance' && (
                    <TouchableOpacity
                      onPress={() => handleUpdateStatus(room.id, 'Maintenance')}
                      disabled={isBusy}
                      style={styles.secondaryChip}
                    >
                      <Text style={styles.secondaryChipText}>Maintenance</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Card>
          );
        })}
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
    paddingTop: 14,
    paddingBottom: 40,
  },
  liveEventToast: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.cardHover,
  },
  liveEventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 10,
  },
  liveEventContent: {
    flex: 1,
  },
  liveEventHeader: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.success,
    letterSpacing: 0.8,
  },
  liveEventText: {
    fontSize: 12,
    color: colors.textWhite,
    marginTop: 1,
  },
  boldText: {
    fontWeight: '800',
    color: colors.textWhite,
  },
  closeToastBtn: {
    padding: 4,
    marginLeft: 8,
  },
  closeToastText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusBarCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  staffBadge: {
    flex: 1,
  },
  staffRoleText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  staffNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  socketDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  socketOnline: {
    backgroundColor: colors.success,
  },
  socketOffline: {
    backgroundColor: colors.warning,
  },
  socketText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  socketTextOnline: {
    color: colors.successDark,
  },
  socketTextOffline: {
    color: colors.warningDark,
  },
  filterChipsRow: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textWhite,
  },
  errorCard: {
    backgroundColor: colors.errorLight,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 12,
    marginBottom: 14,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.errorDark,
  },
  errorText: {
    fontSize: 11,
    color: colors.errorDark,
    marginTop: 2,
  },
  allCleanCard: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  allCleanIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  allCleanTitle: {
    ...typography.h3,
    marginBottom: 4,
  },
  allCleanSub: {
    ...typography.bodySmall,
    textAlign: 'center',
  },
  roomCard: {
    marginBottom: 14,
  },
  dirtyBorder: {
    borderLeftWidth: 5,
    borderLeftColor: colors.warning,
  },
  maintenanceBorder: {
    borderLeftWidth: 5,
    borderLeftColor: colors.error,
  },
  roomCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  roomNumberContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  roomPrefix: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginRight: 5,
  },
  roomNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  roomCategoryName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logBox: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    marginBottom: 10,
  },
  logTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  logText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cleanButton: {
    flex: 1,
    marginRight: 8,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 6,
  },
  secondaryChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
