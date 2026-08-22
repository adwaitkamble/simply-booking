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
  Alert,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import { ApiClient, AvailableRoomItem } from '../api/client';
import { RoomStatus } from '@hotel-pms/types';
import { borderRadius, shadows } from '../theme';
import { GoogleCalendarDatePickerModal } from '../components/GoogleCalendarDatePickerModal';
import { NavigationDrawer, DrawerMenuItemId } from '../components/NavigationDrawer';
import { sendWhatsAppConfirmation } from '../utils/whatsapp';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LEFT_COL_WIDTH = 135;
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
  onOpenBookings?: () => void;
  onOpenRooms?: () => void;
  onOpenMyTeam?: () => void;
  onOpenChangePassword?: () => void;
  onOpenSupport?: () => void;
  onLogout?: () => void;
  onNavigateTab?: (tab: 'booking' | 'housekeeping' | 'invoicing' | 'channel') => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  focusedDate,
  onSelectRoom,
  onOpenBookingForm,
  onOpenInvoice,
  onOpenBookings,
  onOpenRooms,
  onOpenMyTeam,
  onOpenChangePassword,
  onOpenSupport,
  onLogout,
  onNavigateTab,
}) => {
  const [property, setProperty] = useState<any | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const createUtcDateFromLocal = (rawDate?: string | Date) => {
    let now = rawDate ? new Date(rawDate) : new Date();
    if (isNaN(now.getTime())) now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  };

  // Calendar Date Window (Defaults to today's UTC midnight)
  const [baseDate, setBaseDate] = useState<Date>(() => {
    if (focusedDate) {
      return createUtcDateFromLocal(focusedDate);
    }
    return createUtcDateFromLocal();
  });

  // Keep baseDate in sync when focusedDate changes
  useEffect(() => {
    if (focusedDate) {
      setBaseDate(createUtcDateFromLocal(focusedDate));
    }
  }, [focusedDate]);

  // Modals
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null);
  const [showAddRoomModal, setShowAddRoomModal] = useState<boolean>(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState('');
  const [newRoomPrice, setNewRoomPrice] = useState('');
  const [newRoomSize, setNewRoomSize] = useState('');
  const [newRoomStatus, setNewRoomStatus] = useState<RoomStatus>('Clean');
  const [savingRoom, setSavingRoom] = useState<boolean>(false);
  const [roomModalError, setRoomModalError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showNavigationDrawer, setShowNavigationDrawer] = useState<boolean>(false);

  // New Category Creation Inline State
  const [showAddCatForm, setShowAddCatForm] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatBasePrice, setNewCatBasePrice] = useState('');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [savingCat, setSavingCat] = useState<boolean>(false);
  const [catFormError, setCatFormError] = useState<string | null>(null);

  // View Mode: weekly (7 days) or monthly (full calendar month)
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Generate date array based on weekly or monthly view
  const dateColumns = useMemo(() => {
    const dates = [];
    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (viewMode === 'weekly') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(baseDate.getTime());
        d.setUTCDate(baseDate.getUTCDate() + i);
        const isoDate = d.toISOString().slice(0, 10);
        dates.push({
          date: d,
          isoDate,
          dayName: daysOfWeek[d.getUTCDay()],
          dayNum: String(d.getUTCDate()).padStart(2, '0'),
          monthName: months[d.getUTCMonth()],
          isToday: isoDate === todayStr,
          isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
        });
      }
    } else {
      // Monthly view: Show all days of the current month of baseDate, starting from the 1st
      const year = baseDate.getUTCFullYear();
      const month = baseDate.getUTCMonth();
      // Total days in the current month
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(Date.UTC(year, month, i));
        const isoDate = d.toISOString().slice(0, 10);
        dates.push({
          date: d,
          isoDate,
          dayName: daysOfWeek[d.getUTCDay()],
          dayNum: String(i).padStart(2, '0'),
          monthName: months[month],
          isToday: isoDate === todayStr,
          isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
        });
      }
    }
    return dates;
  }, [baseDate, viewMode, todayStr]);

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
          setNewRoomPrice(String(defaultProp.roomCategories[0].basePrice));
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

  const handlePrevRange = () => {
    setBaseDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'weekly') {
        next.setUTCDate(prev.getUTCDate() - 7);
      } else {
        // Go to 1st of previous month
        next.setUTCMonth(prev.getUTCMonth() - 1);
        next.setUTCDate(1);
      }
      return next;
    });
  };

  const handleNextRange = () => {
    setBaseDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'weekly') {
        next.setUTCDate(prev.getUTCDate() + 7);
      } else {
        // Go to 1st of next month
        next.setUTCMonth(prev.getUTCMonth() + 1);
        next.setUTCDate(1);
      }
      return next;
    });
  };

  // Add Room Category Selection Helper
  const handleSelectCategory = (cat: any) => {
    setNewRoomCategory(cat.id);
    if (cat.basePrice !== undefined && cat.basePrice !== null) {
      setNewRoomPrice(String(cat.basePrice));
    }
  };

  // Add Dynamic Room Category Handler
  const handleSaveCategory = async () => {
    if (!newCatName.trim()) {
      setCatFormError('Category Name is required (e.g. Executive Suite)');
      return;
    }
    const priceNum = parseFloat(newCatBasePrice);
    if (!newCatBasePrice || isNaN(priceNum) || priceNum < 0) {
      setCatFormError('Valid Base Price (₹) is required');
      return;
    }

    try {
      setSavingCat(true);
      setCatFormError(null);
      const createdCat = await ApiClient.createRoomCategory({
        name: newCatName.trim(),
        basePrice: priceNum,
        description: newCatDescription.trim() || undefined,
      });

      setCategories((prev) => [...prev, createdCat]);
      setNewRoomCategory(createdCat.id);
      setNewRoomPrice(String(createdCat.basePrice));
      setShowAddCatForm(false);
      setNewCatName('');
      setNewCatBasePrice('');
      setNewCatDescription('');
    } catch (err: any) {
      setCatFormError(err.message || 'Failed to create room category');
    } finally {
      setSavingCat(false);
    }
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
      const customPrice = newRoomPrice.trim() !== '' ? parseFloat(newRoomPrice) : undefined;
      await ApiClient.createRoom({
        roomNumber: newRoomNumber.trim(),
        roomCategoryId: newRoomCategory,
        pricePerNight: customPrice,
        roomSize: newRoomSize.trim() || undefined,
        status: newRoomStatus,
      });
      setShowAddRoomModal(false);
      setNewRoomNumber('');
      setNewRoomPrice('');
      setNewRoomSize('');
      loadData();
    } catch (err: any) {
      setRoomModalError(err.message || 'Failed to create room');
    } finally {
      setSavingRoom(false);
    }
  };

  const handleDeleteRoom = (room: any) => {
    const confirmDelete = async () => {
      try {
        await ApiClient.deleteRoom(room.id);
        if (Platform.OS === 'web') {
          window.alert(`Room #${room.roomNumber} has been removed.`);
        } else {
          Alert.alert('Success', `Room #${room.roomNumber} has been removed.`);
        }
        loadData();
      } catch (err: any) {
        const msg = err?.message || 'Failed to remove room';
        if (Platform.OS === 'web') {
          window.alert(`Cannot Remove Room: ${msg}`);
        } else {
          Alert.alert('Cannot Remove Room', msg);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to remove Room #${room.roomNumber} from your property?`)) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        `Remove Room #${room.roomNumber}`,
        `Are you sure you want to remove Room #${room.roomNumber} from your property?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  const handleDeleteCategory = (cat: any) => {
    if (categories.length <= 1) {
      const msg = 'Cannot delete the only room category. Please create another category first.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Cannot Remove Category', msg);
      }
      return;
    }

    const confirmDelete = async () => {
      try {
        await ApiClient.deleteRoomCategory(cat.id);
        const remaining = categories.filter((c) => c.id !== cat.id);
        setCategories(remaining);
        if (newRoomCategory === cat.id && remaining.length > 0) {
          setNewRoomCategory(remaining[0].id);
          setNewRoomPrice(String(remaining[0].basePrice));
        }
        loadData();
      } catch (err: any) {
        const msg = err?.message || 'Failed to remove category';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Cannot Remove Category', msg);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to remove category "${cat.name}"?`)) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        `Remove Category "${cat.name}"`,
        `Are you sure you want to remove room category "${cat.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  // Compute position and span of reservations for a room
  const getRoomReservationBlocks = (roomObj: any) => {
    if (!dateColumns || dateColumns.length === 0 || !roomObj) return [];

    const targetRoomId = typeof roomObj === 'string' ? roomObj : roomObj.id || roomObj.roomId;
    const targetRoomNum = typeof roomObj === 'object' ? String(roomObj.roomNumber || roomObj.roomName || '').replace('Room ', '').trim() : '';

    const roomRes = reservations.filter((r) => {
      if (r.status === 'Cancelled') return false;
      const resRoomId = r.roomId || r.room?.id;
      const resRoomNum = String(r.room?.roomNumber || r.roomNumber || r.roomNameAndPlan || '').replace('Room ', '').trim();

      const matchesId = targetRoomId && resRoomId && resRoomId === targetRoomId;
      const matchesNum = targetRoomNum && resRoomNum && (resRoomNum.includes(targetRoomNum) || targetRoomNum.includes(resRoomNum));

      return matchesId || matchesNum;
    });

    const firstColIso = dateColumns[0].isoDate;
    const lastColIso = dateColumns[dateColumns.length - 1].isoDate;

    return roomRes
      .map((res) => {
        const rawIn = res.checkIn || res.dates?.rawCheckIn || res.dates?.checkIn;
        const rawOut = res.checkOut || res.dates?.rawCheckOut || res.dates?.checkOut;

        if (!rawIn || !rawOut) return null;

        const resCheckInIso = typeof rawIn === 'string' ? rawIn.slice(0, 10) : new Date(rawIn).toISOString().slice(0, 10);
        const resCheckOutIso = typeof rawOut === 'string' ? rawOut.slice(0, 10) : new Date(rawOut).toISOString().slice(0, 10);

        if (resCheckInIso <= lastColIso && resCheckOutIso >= firstColIso) {
          let startIndex = dateColumns.findIndex((col) => col.isoDate === resCheckInIso);
          if (startIndex === -1) {
            startIndex = resCheckInIso < firstColIso ? 0 : dateColumns.length - 1;
          }

          let endIndex = dateColumns.findIndex((col) => col.isoDate === resCheckOutIso);
          if (endIndex === -1) {
            endIndex = resCheckOutIso > lastColIso ? dateColumns.length : startIndex + 1;
          }

          const rawSpan = endIndex - startIndex;
          const spanDays = rawSpan > 0 ? rawSpan : 1;
          const left = Math.round(startIndex * DATE_COL_WIDTH) + 4;
          const calculatedWidth = Math.round(spanDays * DATE_COL_WIDTH) - 8;
          const width = Math.max(DATE_COL_WIDTH - 12, calculatedWidth);

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
  const dateRangeStr = dateColumns.length > 0 
    ? `${dateColumns[0]?.dayNum} ${dateColumns[0]?.monthName} - ${dateColumns[dateColumns.length - 1]?.dayNum} ${dateColumns[dateColumns.length - 1]?.monthName}, ${dateColumns[0]?.date.getUTCFullYear()}`
    : '';

  return (
    <View style={styles.container}>
      {/* 1. Bright Blue Header */}
      <View style={styles.topHeaderContainer}>
        <View style={styles.headerBrandRow}>
          <TouchableOpacity
            style={styles.headerMenuBtn}
            onPress={() => setShowNavigationDrawer(true)}
            activeOpacity={0.7}
          >
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

        {/* View Mode Toggle Row */}
        <View style={styles.viewModeToggleRow}>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'weekly' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('weekly')}
            activeOpacity={0.8}
          >
            <Text style={[styles.viewModeBtnText, viewMode === 'weekly' && styles.viewModeBtnTextActive]}>
              📅 7-Day View
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'monthly' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('monthly')}
            activeOpacity={0.8}
          >
            <Text style={[styles.viewModeBtnText, viewMode === 'monthly' && styles.viewModeBtnTextActive]}>
              🗓️ Monthly View
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Selector Row with Arrows */}
        <View style={styles.dateSelectorRow}>
          <TouchableOpacity
            style={styles.dateNavBtn}
            onPress={handlePrevRange}
            activeOpacity={0.7}
          >
            <Text style={styles.dateNavBtnText}>◀</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateBarWrapper}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.dateBarLabel}>{viewMode === 'weekly' ? '7-Day Range' : 'Monthly Range'}</Text>
            <View style={styles.dateBarValueRow}>
              <Text style={styles.dateBarIcon}>📅</Text>
              <Text style={styles.dateBarValueText} numberOfLines={1}>
                {dateRangeStr}
              </Text>
              <Text style={styles.dateBarDropdownArrow}>▼</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateNavBtn}
            onPress={handleNextRange}
            activeOpacity={0.7}
          >
            <Text style={styles.dateNavBtnText}>▶</Text>
          </TouchableOpacity>
        </View>
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
              {rooms.map((room) => {
                const roomPrice = room.pricePerNight ?? room.roomCategory?.basePrice;
                return (
                  <View key={room.id} style={styles.leftRoomCell}>
                    <View style={styles.roomHeaderRow}>
                      <Text style={styles.roomNumberText}>#{room.roomNumber}</Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteRoom(room)}
                        style={styles.deleteRoomBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.deleteRoomBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.roomCategoryNameText} numberOfLines={1}>
                      {room.roomCategory?.name || 'Standard'}
                    </Text>
                    <Text style={styles.roomPriceTagText} numberOfLines={1}>
                      ₹{roomPrice ? Number(roomPrice).toLocaleString('en-IN') : 0}/night
                    </Text>
                    {room.roomSize ? (
                      <Text style={styles.roomSizeText} numberOfLines={1}>
                        📐 {room.roomSize}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* RIGHT HORIZONTALLY SCROLLABLE AREA */}
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={true}
              style={styles.rightHorizontalScroll}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
            >
              <View style={{ width: DATE_COL_WIDTH * dateColumns.length }}>
                {/* Date Columns Header Row */}
                <View style={styles.rightHeaderRow}>
                  {dateColumns.map((col) => (
                    <View
                      key={col.isoDate}
                      style={[
                        styles.dateHeaderCell,
                        col.isToday && styles.dateHeaderCellToday,
                        col.isWeekend && styles.dateHeaderCellWeekend,
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
                              col.isWeekend && styles.matrixCellBgWeekend,
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

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 2 }}>
              <Text style={styles.inputLabel}>Room Category *</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddCatForm(!showAddCatForm);
                  setCatFormError(null);
                }}
                style={{ paddingVertical: 2, paddingHorizontal: 6 }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#0066FF' }}>
                  {showAddCatForm ? '✕ Close Category Form' : '+ Add New Category'}
                </Text>
              </TouchableOpacity>
            </View>

            {showAddCatForm ? (
              <View style={styles.inlineCatFormBox}>
                <Text style={styles.inlineCatTitle}>✨ Create Custom Room Category</Text>
                {catFormError ? (
                  <View style={styles.modalErrorBox}>
                    <Text style={styles.modalErrorText}>{catFormError}</Text>
                  </View>
                ) : null}
                <Text style={styles.inputLabel}>Category Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Luxury Villa, Single Bed Room, Penthouse"
                  value={newCatName}
                  onChangeText={setNewCatName}
                  placeholderTextColor="#94a3b8"
                />

                <Text style={styles.inputLabel}>Category Default Base Price (₹) *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 4500"
                  value={newCatBasePrice}
                  onChangeText={setNewCatBasePrice}
                  keyboardType="numeric"
                  placeholderTextColor="#94a3b8"
                />

                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Sea facing balcony, complimentary breakfast..."
                  value={newCatDescription}
                  onChangeText={setNewCatDescription}
                  placeholderTextColor="#94a3b8"
                />

                <TouchableOpacity
                  style={styles.saveCatBtn}
                  onPress={handleSaveCategory}
                  disabled={savingCat}
                >
                  {savingCat ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveCatBtnText}>✓ Save Category</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories.map((cat) => (
                <View
                  key={cat.id}
                  style={[
                    styles.catOptionChip,
                    newRoomCategory === cat.id && styles.catOptionChipActive,
                    { flexDirection: 'row', alignItems: 'center', gap: 6 },
                  ]}
                >
                  <TouchableOpacity onPress={() => handleSelectCategory(cat)}>
                    <Text
                      style={[
                        styles.catOptionText,
                        newRoomCategory === cat.id && styles.catOptionTextActive,
                      ]}
                    >
                      {cat.name} (Base ₹{cat.basePrice})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteCategory(cat)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: newRoomCategory === cat.id ? '#ffffff' : '#ef4444',
                        fontWeight: '800',
                        paddingLeft: 2,
                      }}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Room Price (₹ / night)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 2500, 3200 (Default from category)"
              value={newRoomPrice}
              onChangeText={setNewRoomPrice}
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.inputLabel}>Room Size / Type Details</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 250 sq ft, King Bed, Deluxe Suite"
              value={newRoomSize}
              onChangeText={setNewRoomSize}
              placeholderTextColor="#94a3b8"
            />

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
                    style={styles.detailWaBtn}
                    onPress={() => {
                      sendWhatsAppConfirmation({
                        guestName: selectedReservation.guest?.name || 'Guest',
                        guestPhone: selectedReservation.guest?.phone || '',
                        roomName: selectedReservation.room?.roomNumber ? `Room ${selectedReservation.room.roomNumber}` : 'Room',
                        checkIn: selectedReservation.checkIn.slice(0, 10),
                        checkOut: selectedReservation.checkOut.slice(0, 10),
                        totalAmount: selectedReservation.totalAmount,
                        advancePaid: selectedReservation.advancePaid || 0,
                        balanceAmount: Math.max(0, Number(selectedReservation.totalAmount) - Number(selectedReservation.advancePaid || 0)),
                        bookingId: selectedReservation.bookingId || selectedReservation.id,
                      });
                      if (selectedReservation.id) {
                        ApiClient.sendWhatsAppNotification(selectedReservation.id).catch(() => {});
                      }
                    }}
                  >
                    <Text style={styles.detailWaText}>💬 WhatsApp</Text>
                  </TouchableOpacity>

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
                    <Text style={styles.viewFolioText}>Billing Folio ➔</Text>
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
        checkIn={dateColumns[0]?.isoDate || baseDate.toISOString().slice(0, 10)}
        checkOut={dateColumns[dateColumns.length - 1]?.isoDate || new Date(baseDate.getTime() + (viewMode === 'weekly' ? 6 : 29) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
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
      {/* 5. Navigation Drawer Menu */}
      <NavigationDrawer
        visible={showNavigationDrawer}
        onClose={() => setShowNavigationDrawer(false)}
        onLogout={onLogout}
        propertyName={propertyName}
        ownerName={property?.user?.name || 'Hotel Owner'}
        onSelectMenuItem={(id: DrawerMenuItemId) => {
          switch (id) {
            case 'bookings':
            case 'booking_report':
              if (onOpenBookings) {
                onOpenBookings();
              } else {
                setViewMode('weekly');
              }
              break;
            case 'rooms':
              if (onOpenRooms) {
                onOpenRooms();
              } else {
                setShowAddRoomModal(true);
              }
              break;
            case 'support':
              if (onOpenSupport) {
                onOpenSupport();
              } else {
                Linking.openURL('mailto:adwaitakamble007@gmail.com');
              }
              break;
            case 'invoice_settings':
            case 'tax_settings':
              if (onNavigateTab) onNavigateTab('invoicing');
              break;
            case 'additional_services':
              if (onNavigateTab) onNavigateTab('housekeeping');
              break;
            case 'my_team':
              if (onOpenMyTeam) {
                onOpenMyTeam();
              } else if (onNavigateTab) {
                onNavigateTab('housekeeping');
              }
              break;
            case 'password_change':
              if (onOpenChangePassword) {
                onOpenChangePassword();
              }
              break;
            case 'webapp':
              Linking.openURL('https://simplybooking.com');
              break;
            case 'support':
              Linking.openURL('mailto:support@simplybooking.com');
              break;
            default:
              if (Platform.OS === 'web') {
                window.alert(`Selected Simply booking Menu Item: ${id.replace(/_/g, ' ')}`);
              } else {
                Alert.alert('Simply booking Feature', `Opened ${id.replace(/_/g, ' ').toUpperCase()} section.`);
              }
              break;
          }
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
  viewModeToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  viewModeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  viewModeBtnActive: {
    backgroundColor: '#ffffff',
  },
  viewModeBtnText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  viewModeBtnTextActive: {
    color: '#0066FF',
    fontWeight: '800',
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dateNavBtn: {
    width: 40,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  dateBarWrapper: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    paddingHorizontal: 8,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
  },
  roomHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0066FF',
  },
  deleteRoomBtn: {
    padding: 2,
    borderRadius: 4,
  },
  deleteRoomBtnText: {
    fontSize: 11,
    opacity: 0.7,
  },
  roomCategoryNameText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
    marginTop: 1,
  },
  roomPriceTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
    marginTop: 1,
  },
  roomSizeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1,
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
  dateHeaderCellWeekend: {
    backgroundColor: '#FFF8F8',
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
  matrixCellBgWeekend: {
    backgroundColor: '#FFFBFB',
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
  inlineCatFormBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
  },
  inlineCatTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e40af',
    marginBottom: 6,
  },
  saveCatBtn: {
    backgroundColor: '#0066FF',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    marginTop: 10,
  },
  saveCatBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
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
    gap: 6,
    marginTop: 14,
  },
  detailWaBtn: {
    flex: 1.2,
    backgroundColor: '#25D366',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  detailWaText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  viewFolioBtn: {
    flex: 1.3,
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
