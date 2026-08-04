import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import { ApiClient, AvailableRoomItem } from '../api/client';
import { RoomStatus } from '@hotel-pms/types';
import { borderRadius, shadows } from '../theme';
import { GoogleCalendarDatePickerModal } from '../components/GoogleCalendarDatePickerModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LEFT_COL_WIDTH = 120;
const DATE_COL_WIDTH = 100;
const ROW_HEIGHT = 80;
const HEADER_ROW_HEIGHT = 50;

interface DashboardScreenProps {
  focusedDate?: string;
  onSelectRoom?: (room: AvailableRoomItem, checkIn: string, checkOut: string) => void;
  onOpenBookingForm: (prefilled?: {
    roomId?: string;
    roomNumber?: string;
    checkIn?: string;
    checkOut?: string;
  }) => void;
  onOpenInvoice?: (reservationId: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  focusedDate,
  onSelectRoom,
  onOpenBookingForm,
  onOpenInvoice,
}) => {
  const [property, setProperty] = useState<any | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calendar Date Window (Defaults to today's date)
  const [baseDate, setBaseDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (focusedDate) {
      const d = new Date(focusedDate.slice(0, 10));
      if (!isNaN(d.getTime())) {
        return d < today ? today : d;
      }
    }
    return today;
  });

  // Keep baseDate in sync when focusedDate changes
  useEffect(() => {
    if (focusedDate) {
      const d = new Date(focusedDate.slice(0, 10));
      if (!isNaN(d.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setBaseDate(d < today ? today : d);
      }
    }
  }, [focusedDate]);

  // Modals
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null);
  const [showAddRoomModal, setShowAddRoomModal] = useState<boolean>(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState('');
  const [newRoomStatus, setNewRoomStatus] = useState<RoomStatus>('Clean');
  const [savingRoom, setSavingRoom] = useState<boolean>(false);
  const [roomModalError, setRoomModalError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Generate 7-day array
  const dateColumns = useMemo(() => {
    const dates = [];
    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setUTCDate(baseDate.getUTCDate() + i);
      const isoDate = d.toISOString().slice(0, 10);
      dates.push({
        date: d,
        isoDate,
        dayName: daysOfWeek[d.getUTCDay()],
        dayNum: String(d.getUTCDate()).padStart(2, '0'),
        monthName: months[d.getUTCMonth()],
        isToday: i === 0,
      });
    }
    return dates;
  }, [baseDate]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      // 1. Fetch default property
      const defaultProp = await ApiClient.fetchDefaultProperty();
      setProperty(defaultProp);

      if (defaultProp?.roomCategories) {
        setCategories(defaultProp.roomCategories);
        if (defaultProp.roomCategories.length > 0 && !newRoomCategory) {
          setNewRoomCategory(defaultProp.roomCategories[0].id);
        }
      }

      // 2. Fetch all rooms for this property
      const propertyRooms = await ApiClient.fetchPropertyRooms(defaultProp.id);
      setRooms(propertyRooms);

      // 3. Fetch all active reservations
      const allReservations = await ApiClient.fetchReservations();
      setReservations(allReservations);
    } catch (err: any) {
      console.warn('PMS Data Fetch:', err);
      setError(err.message || 'Connecting to server...');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [newRoomCategory]);

  useEffect(() => {
    loadData();

    // Connect to real-time server for live updates
    const socketUrl = ApiClient.getSocketUrl();
    const socket: Socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('⚡ [Dashboard WebSocket] Connected to Real-Time Server');
    });

    socket.on('reservationCreated', (payload) => {
      console.log('⚡ [Dashboard WebSocket] Live reservation received:', payload?.id);
      loadData();
    });

    socket.on('reservationUpdated', () => {
      loadData();
    });

    socket.on('roomStatusUpdated', () => {
      loadData();
    });

    return () => {
      socket.disconnect();
    };
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const shiftDates = (days: number) => {
    setBaseDate((prev) => {
      const next = new Date(prev);
      next.setUTCDate(prev.getUTCDate() + days);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (next < today) {
        return today;
      }
      return next;
    });
  };

  const jumpToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setBaseDate(today);
  };

  // Add Room Submission
  const handleSaveRoom = async () => {
    if (!newRoomNumber.trim()) {
      setRoomModalError('Room Number is required (e.g. 301)');
      return;
    }
    if (!newRoomCategory) {
      setRoomModalError('Please select a Room Category');
      return;
    }

    try {
      setSavingRoom(true);
      setRoomModalError(null);
      await ApiClient.createRoom({
        roomNumber: newRoomNumber.trim(),
        roomCategoryId: newRoomCategory,
        status: newRoomStatus,
      });
      setShowAddRoomModal(false);
      setNewRoomNumber('');
      loadData();
    } catch (err: any) {
      setRoomModalError(err.message || 'Failed to create room');
    } finally {
      setSavingRoom(false);
    }
  };

  // Compute position and span of reservations for a room
  const getRoomReservationBlocks = (roomId: string) => {
    const roomRes = reservations.filter(
      (r) => r.roomId === roomId && r.status !== 'Cancelled'
    );

    const windowStart = dateColumns[0].date.getTime();
    const windowEnd = dateColumns[6].date.getTime() + 86400000;

    return roomRes
      .map((res) => {
        const checkInTime = new Date(res.checkIn).getTime();
        const checkOutTime = new Date(res.checkOut).getTime();

        if (checkInTime < windowEnd && checkOutTime > windowStart) {
          const startDiffDays = Math.max(
            0,
            (checkInTime - windowStart) / (1000 * 60 * 60 * 24)
          );
          const endDiffDays = Math.min(
            7,
            (checkOutTime - windowStart) / (1000 * 60 * 60 * 24)
          );
          const spanDays = Math.max(1, endDiffDays - startDiffDays);

          const left = Math.round(startDiffDays * DATE_COL_WIDTH) + 4;
          const width = Math.round(spanDays * DATE_COL_WIDTH) - 8;

          return {
            ...res,
            left,
            width,
          };
        }
        return null;
      })
      .filter(Boolean);
  };

  const getStatusBadgeStyle = (status: RoomStatus) => {
    switch (status) {
      case 'Clean':
        return { dot: '#10b981', label: 'Clean', bg: '#dcfce7', text: '#15803d' };
      case 'Dirty':
        return { dot: '#f59e0b', label: 'Dirty', bg: '#fef3c7', text: '#b45309' };
      case 'Maintenance':
        return { dot: '#ef4444', label: 'Maint', bg: '#fee2e2', text: '#b91c1c' };
      default:
        return { dot: '#64748b', label: status, bg: '#f1f5f9', text: '#334155' };
    }
  };

  const propertyName = property?.name || 'Simply Booking Hotel';
  const propertyInitials = (property?.name || 'SP')
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SP';
  const propertyLocation = `${property?.city || 'Pune'}, ${property?.country || 'India'}`;
  const dateRangeStr = `${dateColumns[0]?.dayNum} - ${dateColumns[6]?.dayNum} ${dateColumns[0]?.monthName}, ${dateColumns[0]?.date.getUTCFullYear()}`;

  return (
    <View style={styles.container}>
      {/* 1. Bright Blue Header */}
      <View style={styles.topHeaderContainer}>
        <View style={styles.headerBrandRow}>
          <TouchableOpacity style={styles.headerMenuBtn} activeOpacity={0.7}>
            <Text style={styles.headerMenuText}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.brandTitle} numberOfLines={1}>
            {propertyName}
          </Text>
          <View style={styles.headerRightActions}>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleRefresh} activeOpacity={0.7}>
              <Text style={styles.headerActionText}>🔄</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={() => Linking.openURL('https://calendar.google.com')} activeOpacity={0.7}>
              <Text style={styles.headerActionText}>🔔</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Range Selection Pill */}
        <TouchableOpacity
          style={styles.dateBarWrapper}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.dateBarLabel}>Date range</Text>
          <View style={styles.dateBarValueRow}>
            <Text style={styles.dateBarIcon}>📅</Text>
            <Text style={styles.dateBarValueText}>
              {dateRangeStr}
            </Text>
            <Text style={styles.dateBarDropdownArrow}>▼</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 2. Main 2D Gantt Chart Grid Area */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066FF" />
          <Text style={styles.loadingTitle}>Simply Booking</Text>
          <Text style={styles.loadingSub}>Loading 2D Reservation Matrix...</Text>
        </View>
      ) : error && rooms.length === 0 ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Connection Notice</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.verticalScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#0066FF"
            />
          }
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          scrollEventThrottle={16}
        >
          <View style={styles.ganttContainer}>
            {/* LEFT FIXED COLUMN: Room Labels */}
            <View style={styles.leftColumn}>
              {/* Rooms Header Cell */}
              <View style={styles.leftHeaderCell}>
                <Text style={styles.leftHeaderTitle}>Rooms</Text>
                <TouchableOpacity
                  style={styles.addRoomBtn}
                  onPress={() => setShowAddRoomModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addRoomBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Room Rows */}
              {rooms.map((room) => (
                <View key={room.id} style={styles.leftRoomCell}>
                  <Text style={styles.roomNumberText}>#{room.roomNumber}</Text>
                  <Text style={styles.roomCategoryText} numberOfLines={1}>
                    {room.roomCategory?.name || 'Standard'}
                  </Text>
                </View>
              ))}
            </View>

            {/* RIGHT HORIZONTALLY SCROLLABLE AREA */}
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={true}
              style={styles.rightHorizontalScroll}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
            >
              <View style={{ width: DATE_COL_WIDTH * 7 }}>
                {/* Date Columns Header Row */}
                <View style={styles.rightHeaderRow}>
                  {dateColumns.map((col) => (
                    <View
                      key={col.isoDate}
                      style={[
                        styles.dateHeaderCell,
                        col.isToday && styles.dateHeaderCellToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNameText,
                          col.isToday && styles.dayNameTextToday,
                        ]}
                      >
                        {col.dayName.charAt(0) + col.dayName.slice(1).toLowerCase()}
                      </Text>
                      <Text
                        style={[
                          styles.dayNumText,
                          col.isToday && styles.dayNumTextToday,
                        ]}
                      >
                        {col.dayNum}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Matrix Rows */}
                {rooms.map((room) => {
                  const blocks = getRoomReservationBlocks(room.id);
                  return (
                    <View key={room.id} style={styles.matrixRow}>
                      {/* Grid Background Cells */}
                      {dateColumns.map((col, idx) => {
                        const cellDateMs = new Date(col.isoDate).getTime();
                        const cellRes = reservations.find(
                          (r) =>
                            r.roomId === room.id &&
                            r.status !== 'Cancelled' &&
                            new Date(r.checkIn).getTime() <= cellDateMs + 86400000 - 1 &&
                            new Date(r.checkOut).getTime() > cellDateMs
                        );

                        return (
                          <TouchableOpacity
                            key={col.isoDate}
                            style={[
                              styles.matrixCellBg,
                              idx % 2 === 1 && styles.matrixCellBgAlt,
                            ]}
                            activeOpacity={0.6}
                            delayPressIn={50}
                            onPress={() => {
                              if (cellRes) {
                                setSelectedReservation(cellRes);
                                return;
                              }
                              const dOut = new Date(col.date);
                              dOut.setUTCDate(dOut.getUTCDate() + 2);
                              onOpenBookingForm({
                                roomId: room.id,
                                roomNumber: room.roomNumber,
                                checkIn: col.isoDate,
                                checkOut: dOut.toISOString().slice(0, 10),
                              });
                            }}
                          >
                            {!cellRes && (
                              <View style={styles.emptyCellIconBox}>
                                <Text style={styles.emptyCellIcon}>📅</Text>
                                <Text style={styles.emptyCellPlus}>+</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}

                      {/* Overlaid Continuous Reservation Blocks */}
                      {blocks.map((res: any) => {
                        // Alternate colors between green and orange for standard visually sober look
                        const isEven = res.guest?.name?.charCodeAt(0) % 2 === 0;
                        const blockStyle = isEven ? styles.reservationBlockOrange : styles.reservationBlockGreen;
                        const textStyle = isEven ? styles.blockGuestNameOrange : styles.blockGuestNameGreen;
                        const subStyle = isEven ? styles.blockOccupancyOrange : styles.blockOccupancyGreen;

                        return (
                          <TouchableOpacity
                            key={res.id}
                            style={[
                              styles.reservationBlock,
                              blockStyle,
                              {
                                left: res.left,
                                width: res.width,
                              },
                            ]}
                            onPress={() => setSelectedReservation(res)}
                            activeOpacity={0.9}
                            delayPressIn={50}
                          >
                            <Text style={[styles.blockGuestName, textStyle]} numberOfLines={1}>
                              {res.guest?.name || 'Guest'}
                            </Text>

                            <View style={styles.blockMetaRow}>
                              <Text style={[styles.blockOccupancy, subStyle]}>
                                👥 {res.adults || 1}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {/* FAB and Tooltip */}
      <View style={styles.fabContainer}>
        <View style={styles.fabTooltip}>
          <Text style={styles.fabTooltipText}>Click here to make a booking</Text>
          <View style={styles.tooltipArrow} />
        </View>
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => onOpenBookingForm()}
          activeOpacity={0.85}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      </View>

      {/* 4. Modal: [+] Add Room */}
      <Modal
        visible={showAddRoomModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddRoomModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add In-House Room</Text>
              <TouchableOpacity
                onPress={() => setShowAddRoomModal(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {roomModalError ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{roomModalError}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Room Number *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 301, 302, PH-01"
              value={newRoomNumber}
              onChangeText={setNewRoomNumber}
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.inputLabel}>Room Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catOptionChip,
                    newRoomCategory === cat.id && styles.catOptionChipActive,
                  ]}
                  onPress={() => setNewRoomCategory(cat.id)}
                >
                  <Text
                    style={[
                      styles.catOptionText,
                      newRoomCategory === cat.id && styles.catOptionTextActive,
                    ]}
                  >
                    {cat.name} (₹{cat.basePrice})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Initial Status</Text>
            <View style={styles.statusOptionRow}>
              {(['Clean', 'Dirty', 'Maintenance'] as RoomStatus[]).map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[
                    styles.statusRadioChip,
                    newRoomStatus === st && styles.statusRadioChipActive,
                  ]}
                  onPress={() => setNewRoomStatus(st)}
                >
                  <Text
                    style={[
                      styles.statusRadioText,
                      newRoomStatus === st && styles.statusRadioTextActive,
                    ]}
                  >
                    {st}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddRoomModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSaveRoom}
                disabled={savingRoom}
              >
                {savingRoom ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save Room</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. Modal: Reservation Detail & Quick Folio */}
      <Modal
        visible={!!selectedReservation}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedReservation(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContent}>
            {selectedReservation ? (
              <>
                <View style={styles.detailOccupiedBanner}>
                  <Text style={styles.detailOccupiedIcon}>🔒</Text>
                  <Text style={styles.detailOccupiedTitle}>ROOM OCCUPIED • SYSTEM LOCKED</Text>
                </View>

                <View style={styles.detailHeader}>
                  <View>
                    <Text style={styles.detailRoomTag}>
                      ROOM {selectedReservation.room?.roomNumber || 'Room'}
                    </Text>
                    <Text style={styles.detailGuestName}>
                      {selectedReservation.guest?.name || 'Guest'}
                    </Text>
                  </View>
                  <View style={styles.detailStatusTag}>
                    <Text style={styles.detailStatusText}>
                      {selectedReservation.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailDivider} />

                <View style={styles.detailInfoGrid}>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Contact:</Text>
                    <Text style={styles.detailValue}>
                      {selectedReservation.guest?.phone || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Dates:</Text>
                    <Text style={styles.detailValue}>
                      {selectedReservation.checkIn.slice(0, 10)} to {selectedReservation.checkOut.slice(0, 10)}
                    </Text>
                  </View>

                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Occupancy:</Text>
                    <Text style={styles.detailValue}>
                      {selectedReservation.adults || 1} Adult(s), {selectedReservation.children || 0} Child(ren)
                    </Text>
                  </View>

                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Total Rate:</Text>
                    <Text style={styles.detailPriceValue}>
                      ₹{Number(selectedReservation.totalAmount).toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Advance Paid:</Text>
                    <Text style={styles.detailValue}>
                      ₹{Number(selectedReservation.advancePaid || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Balance Due:</Text>
                    <Text style={styles.detailBalanceValue}>
                      ₹{Math.max(0, Number(selectedReservation.totalAmount) - Number(selectedReservation.advancePaid || 0)).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                {selectedReservation.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Notes / Requests:</Text>
                    <Text style={styles.notesText}>{selectedReservation.notes}</Text>
                  </View>
                ) : null}

                <View style={styles.detailActionRow}>
                  <TouchableOpacity
                    style={styles.viewFolioBtn}
                    onPress={() => {
                      const resId = selectedReservation.id;
                      setSelectedReservation(null);
                      if (onOpenInvoice) {
                        onOpenInvoice(resId);
                      }
                    }}
                  >
                    <Text style={styles.viewFolioText}>View Billing Folio ➔</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.closeDetailBtn}
                    onPress={() => setSelectedReservation(null)}
                  >
                    <Text style={styles.closeDetailText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
      {/* 6. Date Picker Modal for Dashboard Date Range Selection */}
      <GoogleCalendarDatePickerModal
        visible={showDatePicker}
        checkIn={baseDate.toISOString().slice(0, 10)}
        checkOut={new Date(baseDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
        onClose={() => setShowDatePicker(false)}
        existingReservations={reservations}
        onApply={(newIn, newOut) => {
          const d = new Date(newIn);
          if (!isNaN(d.getTime())) {
            setBaseDate(d);
          }
          setShowDatePicker(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  // Bright Blue Header
  topHeaderContainer: {
    backgroundColor: '#0066FF',
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerMenuBtn: {
    marginRight: 16,
  },
  headerMenuText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '300',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerActionBtn: {
    padding: 2,
  },
  headerActionText: {
    color: '#ffffff',
    fontSize: 20,
  },
  dateBarWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dateBarLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateBarValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateBarIcon: {
    fontSize: 14,
    color: '#ffffff',
    marginRight: 8,
  },
  dateBarValueText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  dateBarDropdownArrow: {
    color: '#ffffff',
    fontSize: 10,
    marginLeft: 8,
  },
  // 2D Gantt Matrix Layout
  verticalScroll: {
    flex: 1,
  },
  ganttContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
  },
  // Left Fixed Column
  leftColumn: {
    width: LEFT_COL_WIDTH,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#ffffff',
  },
  leftHeaderCell: {
    height: HEADER_ROW_HEIGHT,
    backgroundColor: '#EBF3FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#D0E1FD',
    paddingVertical: 4,
  },
  leftHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0066FF',
  },
  addRoomBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  addRoomBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: -1,
  },
  leftRoomCell: {
    height: ROW_HEIGHT,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
  },
  roomNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#718096',
  },
  roomCategoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A202C',
    marginTop: 2,
  },
  // Right Scrollable Matrix
  rightHorizontalScroll: {
    flex: 1,
  },
  rightHeaderRow: {
    flexDirection: 'row',
    height: HEADER_ROW_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateHeaderCell: {
    width: DATE_COL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateHeaderCellToday: {
    backgroundColor: '#F7FAFC',
  },
  dayNameText: {
    fontSize: 11,
    color: '#718096',
    fontWeight: '600',
  },
  dayNameTextToday: {
    color: '#0066FF',
  },
  dayNumText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1D2430',
    marginTop: 2,
  },
  dayNumTextToday: {
    color: '#0066FF',
  },
  matrixRow: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  matrixCellBg: {
    width: DATE_COL_WIDTH,
    height: '100%',
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixCellBgAlt: {
    backgroundColor: '#FAFCFF',
  },
  emptyCellIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    opacity: 0.6,
  },
  emptyCellIcon: {
    fontSize: 11,
    color: '#A0AEC0',
  },
  emptyCellPlus: {
    fontSize: 9,
    fontWeight: '900',
    color: '#A0AEC0',
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  // Reservation Card Blocks
  reservationBlock: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    borderRadius: 24,
    paddingHorizontal: 16,
    justifyContent: 'center',
    zIndex: 5,
    borderWidth: 1,
  },
  reservationBlockGreen: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  reservationBlockOrange: {
    backgroundColor: '#FFE0B2',
    borderColor: '#FFE0B2',
  },
  blockGuestName: {
    fontSize: 12,
    fontWeight: '700',
  },
  blockGuestNameGreen: {
    color: '#1B5E20',
  },
  blockGuestNameOrange: {
    color: '#E65100',
  },
  blockMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  blockOccupancy: {
    fontSize: 10,
    fontWeight: '600',
  },
  blockOccupancyGreen: {
    color: '#1B5E20',
  },
  blockOccupancyOrange: {
    color: '#E65100',
  },
  // FAB and Tooltip
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
  },
  fabTooltip: {
    backgroundColor: '#E6F0FF',
    borderColor: '#0066FF',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
    position: 'relative',
  },
  fabTooltipText: {
    color: '#0066FF',
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipArrow: {
    position: 'absolute',
    right: -6,
    top: 10,
    width: 10,
    height: 10,
    backgroundColor: '#E6F0FF',
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: '#0066FF',
    transform: [{ rotate: '45deg' }],
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6F3C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  fabIcon: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '300',
    marginTop: -2,
  },
  // Loading & Error States
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 14,
  },
  loadingSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  errorSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#0066FF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: '700',
  },
  modalErrorBox: {
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  modalErrorText: {
    color: '#b91c1c',
    fontSize: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  catOptionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    marginRight: 6,
  },
  catOptionChipActive: {
    borderColor: '#0066FF',
    backgroundColor: '#eff6ff',
  },
  catOptionText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  catOptionTextActive: {
    color: '#0066FF',
    fontWeight: '800',
  },
  statusOptionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statusRadioChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  statusRadioChipActive: {
    borderColor: '#0066FF',
    backgroundColor: '#eff6ff',
  },
  statusRadioText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  statusRadioTextActive: {
    color: '#0066FF',
    fontWeight: '800',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalCancelText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#0066FF',
  },
  modalSubmitText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  // Detail Modal
  detailModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  detailOccupiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
    gap: 6,
  },
  detailOccupiedIcon: {
    fontSize: 14,
  },
  detailOccupiedTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#b91c1c',
    letterSpacing: 0.5,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailRoomTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066FF',
  },
  detailGuestName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  detailStatusTag: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detailStatusText: {
    color: '#15803d',
    fontWeight: '800',
    fontSize: 11,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  detailInfoGrid: {
    gap: 6,
  },
  detailInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  detailPriceValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  detailBalanceValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#dc2626',
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  notesText: {
    fontSize: 11,
    color: '#0f172a',
    marginTop: 2,
  },
  detailActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  viewFolioBtn: {
    flex: 1.5,
    backgroundColor: '#0066FF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewFolioText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  closeDetailBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeDetailText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
});
