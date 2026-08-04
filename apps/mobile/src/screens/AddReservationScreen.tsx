import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { ApiClient, AvailableRoomItem } from '../api/client';
import { GoogleCalendarDatePickerModal } from '../components/GoogleCalendarDatePickerModal';
import { colors, borderRadius, shadows } from '../theme';

interface AddReservationScreenProps {
  initialRoomId?: string;
  initialRoomNumber?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  onBack: () => void;
  onBookingSuccess: (reservationId?: string, checkInDate?: string) => void;
}

interface ServiceAddon {
  id: string;
  name: string;
  price: number;
  selected: boolean;
}

export const AddReservationScreen: React.FC<AddReservationScreenProps> = ({
  initialRoomId,
  initialRoomNumber,
  initialCheckIn = '2026-12-01',
  initialCheckOut = '2026-12-03',
  onBack,
  onBookingSuccess,
}) => {
  // Stay Parameters with robust date initialization
  const [checkIn, setCheckIn] = useState(() => {
    const raw = initialCheckIn ? initialCheckIn.slice(0, 10) : '2026-12-01';
    return isNaN(new Date(raw).getTime()) ? '2026-12-01' : raw;
  });

  const [checkOut, setCheckOut] = useState(() => {
    const rawIn = initialCheckIn ? initialCheckIn.slice(0, 10) : '2026-12-01';
    const rawOut = initialCheckOut ? initialCheckOut.slice(0, 10) : '2026-12-03';
    const dIn = new Date(rawIn);
    const dOut = new Date(rawOut);
    if (!isNaN(dIn.getTime()) && !isNaN(dOut.getTime()) && dOut.getTime() > dIn.getTime()) {
      return rawOut;
    }
    // Fallback: 2 days after check-in
    const safeOut = new Date(dIn.getTime() + 2 * 24 * 60 * 60 * 1000);
    return safeOut.toISOString().slice(0, 10);
  });

  // Calendar Dashboard Modal & Existing Bookings State
  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);
  const [existingReservations, setExistingReservations] = useState<any[]>([]);

  const [checkInTime, setCheckInTime] = useState('12:00 PM');
  const [checkOutTime, setCheckOutTime] = useState('11:00 AM');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // Room Selection
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [showRoomPicker, setShowRoomPicker] = useState(false);

  // Guest Details
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('+91 ');
  const [guestEmail, setGuestEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('411001');
  const [idNumber, setIdNumber] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [hostName, setHostName] = useState('Front Desk - Adwait');
  const [notes, setNotes] = useState('');

  // Ancillary Services
  const [services, setServices] = useState<ServiceAddon[]>([
    { id: 'srv-1', name: 'Airport Pickup & Drop (Pune Int)', price: 850, selected: false },
    { id: 'srv-2', name: 'Buffet Breakfast Included (Per Stay)', price: 600, selected: false },
    { id: 'srv-3', name: 'Ayurvedic Spa & Wellness Package', price: 1500, selected: false },
  ]);

  // Financials
  const [advancePaid, setAdvancePaid] = useState('1000');

  // Status & Errors
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Helper to validate date string
  const isValidDateStr = (str: string) => {
    if (!str || str.trim().length < 10) return false;
    const d = new Date(str.trim().slice(0, 10));
    return !isNaN(d.getTime());
  };

  // Helper to format date nicely
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Select Date';
    try {
      const clean = dateStr.slice(0, 10);
      const parts = clean.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-US', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        }
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Fetch all existing reservations to display live occupancy dots on the calendar
  useEffect(() => {
    ApiClient.fetchReservations()
      .then((res) => {
        if (Array.isArray(res)) setExistingReservations(res);
      })
      .catch(() => {});
  }, []);

  // Load available rooms on mount or date change
  useEffect(() => {
    const fetchRooms = async () => {
      const cleanIn = checkIn.trim().slice(0, 10);
      const cleanOut = checkOut.trim().slice(0, 10);

      if (!isValidDateStr(cleanIn) || !isValidDateStr(cleanOut)) {
        return; // Incomplete date input
      }

      const dIn = new Date(cleanIn);
      const dOut = new Date(cleanOut);
      if (dOut.getTime() <= dIn.getTime()) {
        return; // Check-out must be after check-in
      }

      try {
        setLoadingRooms(true);
        const startIso = `${cleanIn}T14:00:00.000Z`;
        const endIso = `${cleanOut}T10:00:00.000Z`;
        const data = await ApiClient.fetchAvailableRooms(startIso, endIso);
        setAvailableRooms(data);

        // Preselect room if initialRoomId is provided
        if (initialRoomId) {
          const matched = data.find((r) => r.id === initialRoomId);
          if (matched) {
            setSelectedRoom(matched);
          } else if (initialRoomNumber) {
            // Fallback object
            setSelectedRoom({
              id: initialRoomId,
              roomNumber: initialRoomNumber,
              roomCategory: { name: 'Assigned Room', basePrice: 2500 },
            });
          }
        } else if (data.length > 0 && (!selectedRoom || !data.some((r) => r.id === selectedRoom.id))) {
          setSelectedRoom(data[0]);
        }
      } catch (err: any) {
        console.warn('Failed to load rooms:', err?.message || err);
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchRooms();
  }, [checkIn, checkOut, initialRoomId]);

  // Calculate pricing
  const calculations = useMemo(() => {
    let nights = 1;
    try {
      const d1 = new Date(checkIn);
      const d2 = new Date(checkOut);
      const diffDays = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      nights = Math.max(1, diffDays);
    } catch {
      nights = 1;
    }

    const basePrice = Number(selectedRoom?.roomCategory?.basePrice || 2500);
    const roomSubtotal = nights * basePrice;

    const servicesTotal = services
      .filter((s) => s.selected)
      .reduce((sum, s) => sum + s.price, 0);

    const netPayable = roomSubtotal + servicesTotal;
    const adv = Number(advancePaid) || 0;
    const balance = Math.max(0, netPayable - adv);

    return {
      nights,
      basePrice,
      roomSubtotal,
      servicesTotal,
      netPayable,
      balance,
    };
  }, [checkIn, checkOut, selectedRoom, services, advancePaid]);

  const toggleService = (id: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  // Check if currently selected room is occupied for chosen dates
  const isSelectedRoomOccupied = Boolean(
    selectedRoom &&
      availableRooms.length > 0 &&
      !availableRooms.some((r) => r.id === selectedRoom.id)
  );

  const handleBookingSubmit = async () => {
    // Resolve guest details with friendly defaults if user skipped sections
    const finalGuestName = guestName.trim() || 'Walk-in Guest';
    const finalGuestPhone =
      guestPhone.trim() && guestPhone.trim() !== '+91'
        ? guestPhone.trim()
        : '+91 9823012345';

    // Check if room is already booked for these dates
    if (isSelectedRoomOccupied && selectedRoom) {
      setConflictError(
        `Room ${selectedRoom.roomNumber} is already booked for the selected stay dates (${checkIn} to ${checkOut}). Double booking is blocked. Please choose an available room or change your dates.`
      );
      return;
    }

    // Ensure a room is selected
    const activeRoom = selectedRoom || (availableRooms.length > 0 ? availableRooms[0] : null);
    if (!activeRoom?.id) {
      setFormError('Please select or assign an available room for these dates');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      setConflictError(null);

      const checkInIso = checkIn.includes('T') ? checkIn : `${checkIn}T14:00:00.000Z`;
      const checkOutIso = checkOut.includes('T') ? checkOut : `${checkOut}T10:00:00.000Z`;

      const result = await ApiClient.createReservation({
        guest: {
          name: finalGuestName,
          phone: finalGuestPhone,
          email: guestEmail.trim() || undefined,
          address: address.trim() || undefined,
          pincode: pincode.trim() || undefined,
          idNumber: idNumber.trim() || undefined,
          passportNumber: passportNumber.trim() || undefined,
          dob: dateOfBirth.trim() || undefined,
          hostName: hostName.trim() || undefined,
        },
        guestName: finalGuestName,
        guestPhone: finalGuestPhone,
        guestEmail: guestEmail.trim() || undefined,
        address: address.trim() || undefined,
        pincode: pincode.trim() || undefined,
        idNumber: idNumber.trim() || undefined,
        passportNumber: passportNumber.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
        hostName: hostName.trim() || undefined,
        roomId: activeRoom.id,
        checkIn: checkInIso,
        checkOut: checkOutIso,
        checkInTime,
        checkOutTime,
        adults,
        children,
        totalAmount: calculations.netPayable,
        advancePaid: Number(advancePaid) || 0,
        notes: notes.trim() || undefined,
        status: 'Confirmed',
      });

      setSuccessData(result);
    } catch (err: any) {
      if (err.statusCode === 409) {
        setConflictError(
          err.message || 'Room is already booked for these dates by another customer. Double booking prevented.'
        );
      } else {
        setFormError(err.message || 'Failed to create reservation');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Royal Blue Header */}
      <View style={styles.blueHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>Add Reservation</Text>
          <Text style={styles.headerSubtitle}>
            The Royal Maratha Resort • Pune Front Desk
          </Text>
        </View>

        <View style={styles.gCalBadge}>
          <Text style={styles.gCalBadgeText}>📅 G-CAL</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Confirmation Toast */}
        {successData ? (
          <View style={styles.successToast}>
            <View style={styles.successIconCircle}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>[201 CREATED] Reservation Booked!</Text>
            <Text style={styles.successSub}>
              PostgreSQL row locked & synced to Google Calendar.
            </Text>

            <View style={styles.successSummaryBox}>
              <Text style={styles.successSummaryRow}>
                <Text style={styles.successLabel}>Guest: </Text>
                {successData.guest?.name || guestName}
              </Text>
              <Text style={styles.successSummaryRow}>
                <Text style={styles.successLabel}>Room: </Text>
                {selectedRoom?.roomNumber} ({selectedRoom?.roomCategory?.name})
              </Text>
              <Text style={styles.successSummaryRow}>
                <Text style={styles.successLabel}>Dates: </Text>
                {checkIn} to {checkOut} ({calculations.nights} Nights)
              </Text>
              <Text style={styles.successSummaryRow}>
                <Text style={styles.successLabel}>Total Folio: </Text>
                ₹{Number(successData.totalAmount).toLocaleString('en-IN')} (Advance: ₹{advancePaid})
              </Text>
              <Text style={styles.successSummaryRow}>
                <Text style={styles.successLabel}>Balance Due: </Text>
                ₹{calculations.balance.toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={styles.successBtnRow}>
              {/* WhatsApp Share Button */}
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={() => {
                  const phone = successData.guest?.phone || guestPhone;
                  const name = successData.guest?.name || guestName;
                  const roomNum = selectedRoom?.roomNumber || '101';
                  const hotelName = selectedRoom?.roomCategory?.property?.name || 'Simply Booking Hotel';
                  const calendarLink = successData.calendarLink;

                  const total = successData.totalAmount || calculations.netPayable;
                  const pending = calculations.balance;
                  const currencySymbol = selectedRoom?.roomCategory?.property?.currency === 'USD' ? '$' : '₹';

                  const message = `Hello ${name},\n\n` +
                    `Your booking at *${hotelName}* is confirmed! 🎉\n\n` +
                    `🏨 *Room:* Room ${roomNum}\n` +
                    `📅 *Check-in:* ${checkIn}\n` +
                    `📅 *Check-out:* ${checkOut}\n` +
                    `💰 *Total Amount:* ${currencySymbol}${Number(total).toLocaleString('en-IN')}\n` +
                    `💳 *Pending Amount:* ${currencySymbol}${Number(pending).toLocaleString('en-IN')}\n\n` +
                    (calendarLink ? `📅 *Google Calendar Link:* ${calendarLink}\n\n` : '') +
                    `Thank you for choosing Simply Booking. Have a wonderful stay! 🌿`;

                  // Format phone number: strip spaces, non-numeric characters (keep plus sign)
                  const cleanPhone = phone.replace(/[^\d+]/g, '');
                  const url = `whatsapp://send?text=${encodeURIComponent(message)}&phone=${cleanPhone}`;
                  
                  Linking.canOpenURL(url)
                    .then((supported) => {
                      if (supported) {
                        return Linking.openURL(url);
                      } else {
                        // Fallback to web link
                        const webUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}&phone=${cleanPhone}`;
                        return Linking.openURL(webUrl);
                      }
                    })
                    .catch((err) => {
                      Alert.alert('Error', 'Unable to open WhatsApp.');
                    });
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.whatsappBtnText}>💬 Share on WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.returnBtn}
                onPress={() => onBookingSuccess(successData.id, checkIn)}
                activeOpacity={0.85}
              >
                <Text style={styles.returnBtnText}>View on Calendar Matrix ➔</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.calOpenBtn}
                onPress={() => Linking.openURL('https://calendar.google.com')}
                activeOpacity={0.85}
              >
                <Text style={styles.calOpenBtnText}>View in Google Calendar ↗</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* 409 Concurrency Error Toast */}
        {conflictError ? (
          <View style={styles.conflictToast}>
            <Text style={styles.conflictTitle}>⚠️ [409 CONFLICT] Room Collision</Text>
            <Text style={styles.conflictText}>{conflictError}</Text>
            <TouchableOpacity
              style={styles.conflictChangeRoomBtn}
              onPress={() => setShowRoomPicker(true)}
            >
              <Text style={styles.conflictChangeRoomBtnText}>Assign Different Room</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* General Error Banner */}
        {formError ? (
          <View style={styles.formErrorBanner}>
            <Text style={styles.formErrorText}>⚠️ {formError}</Text>
          </View>
        ) : null}

        {!successData ? (
          <>
            {/* Section 1: Stay Dates & Times */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>1. Stay Dates & Timings</Text>
                <TouchableOpacity
                  style={styles.headerGCalPillBtn}
                  onPress={() => setShowCalendarModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.headerGCalPillIcon}>📅</Text>
                  <Text style={styles.headerGCalPillText}>Interactive Calendar</Text>
                </TouchableOpacity>
              </View>

              {/* Row 1: Interactive Date Selector Cards */}
              <View style={styles.fieldRow}>
                <TouchableOpacity
                  style={[styles.fieldCol, styles.dateTouchCard]}
                  onPress={() => setShowCalendarModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dateCardHeader}>
                    <Text style={styles.fieldLabel}>Check-In Date *</Text>
                    <View style={styles.inTagMini}>
                      <Text style={styles.inTagMiniText}>CHECK-IN</Text>
                    </View>
                  </View>
                  <View style={styles.dateValRow}>
                    <Text style={styles.dateCardIcon}>📅</Text>
                    <Text style={styles.dateCardValueText}>{formatDateDisplay(checkIn)}</Text>
                  </View>
                  <Text style={styles.dateTapHint}>Tap to change on calendar ➔</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.fieldCol, styles.dateTouchCard]}
                  onPress={() => setShowCalendarModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dateCardHeader}>
                    <Text style={styles.fieldLabel}>Check-Out Date *</Text>
                    <View style={styles.stayNightsTag}>
                      <Text style={styles.stayNightsTagText}>{calculations.nights}N STAY</Text>
                    </View>
                  </View>
                  <View style={styles.dateValRow}>
                    <Text style={styles.dateCardIcon}>📅</Text>
                    <Text style={styles.dateCardValueText}>{formatDateDisplay(checkOut)}</Text>
                  </View>
                  <Text style={styles.dateTapHint}>Tap to change on calendar ➔</Text>
                </TouchableOpacity>
              </View>

              {/* Google Calendar Interactive Dashboard Launcher Banner */}
              <TouchableOpacity
                style={styles.gCalDashboardBanner}
                onPress={() => setShowCalendarModal(true)}
                activeOpacity={0.85}
              >
                <View style={styles.gCalBannerIconBox}>
                  <Text style={styles.gCalBannerIcon}>🗓️</Text>
                </View>
                <View style={styles.gCalBannerTextCol}>
                  <View style={styles.gCalBannerTitleRow}>
                    <Text style={styles.gCalBannerTitle}>Google Calendar Stay Grid</Text>
                    <View style={styles.liveSyncPill}>
                      <View style={styles.liveSyncDot} />
                      <Text style={styles.liveSyncText}>SYNC</Text>
                    </View>
                  </View>
                  <Text style={styles.gCalBannerSub}>
                    View month matrix, live booked dates & 1-tap select check-in / check-out
                  </Text>
                </View>
                <Text style={styles.gCalBannerArrow}>›</Text>
              </TouchableOpacity>

              {/* Row 2: Times */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Check-In Time</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={checkInTime}
                    onChangeText={setCheckInTime}
                    placeholder="12:00 PM"
                  />
                </View>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Check-Out Time</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={checkOutTime}
                    onChangeText={setCheckOutTime}
                    placeholder="11:00 AM"
                  />
                </View>
              </View>

              {/* Row 3: Occupancy */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Adults *</Text>
                  <View style={styles.counterRow}>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => setAdults((a) => Math.max(1, a - 1))}
                    >
                      <Text style={styles.counterBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{adults}</Text>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => setAdults((a) => a + 1)}
                    >
                      <Text style={styles.counterBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Children</Text>
                  <View style={styles.counterRow}>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => setChildren((c) => Math.max(0, c - 1))}
                    >
                      <Text style={styles.counterBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{children}</Text>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => setChildren((c) => c + 1)}
                    >
                      <Text style={styles.counterBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Section 2: Room Assignment */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>2. Room Assignment</Text>

              {selectedRoom ? (
                <View
                  style={[
                    styles.selectedRoomCard,
                    isSelectedRoomOccupied && styles.selectedRoomCardOccupied,
                  ]}
                >
                  <View style={styles.selectedRoomHeader}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={[
                            styles.selectedRoomNum,
                            isSelectedRoomOccupied && styles.selectedRoomNumOccupied,
                          ]}
                        >
                          Room {selectedRoom.roomNumber}
                        </Text>
                        {isSelectedRoomOccupied && (
                          <View style={styles.occupiedBadge}>
                            <Text style={styles.occupiedBadgeText}>🚫 ALREADY BOOKED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.selectedRoomCat}>
                        {selectedRoom.roomCategory?.name || 'Standard'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.selectedRoomRate,
                        isSelectedRoomOccupied && styles.selectedRoomRateOccupied,
                      ]}
                    >
                      ₹{Number(selectedRoom.roomCategory?.basePrice || 2500).toLocaleString('en-IN')}/night
                    </Text>
                  </View>

                  {isSelectedRoomOccupied ? (
                    <View style={styles.occupiedNoticeBox}>
                      <Text style={styles.occupiedNoticeText}>
                        ⚠️ Room {selectedRoom.roomNumber} is already reserved for {checkIn} to {checkOut}. Please select an available room.
                      </Text>
                      <TouchableOpacity
                        style={styles.occupiedChangeBtn}
                        onPress={() => setShowRoomPicker(true)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.occupiedChangeBtnText}>⚡ Assign Available Room Now</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.changeRoomLink}
                      onPress={() => setShowRoomPicker(true)}
                    >
                      <Text style={styles.changeRoomLinkText}>Change Assigned Room ⇄</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.assignRoomButton}
                  onPress={() => setShowRoomPicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.assignRoomButtonText}>+ Assign / Select Room</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Section 3: Guest Information */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>3. Guest Details</Text>

              {/* Row 4: Name & Phone */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Primary Guest Name *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. Rahul Patil"
                    value={guestName}
                    onChangeText={setGuestName}
                  />
                </View>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Contact Number *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="+91 9876543210"
                    keyboardType="phone-pad"
                    value={guestPhone}
                    onChangeText={setGuestPhone}
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.fieldFull}>
                <Text style={styles.fieldLabel}>E-mail Address (Optional)</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="rahul.patil@example.com"
                  keyboardType="email-address"
                  value={guestEmail}
                  onChangeText={setGuestEmail}
                />
              </View>

              {/* Row 5: Address & Pincode */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Address (Optional)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Koregaon Park, Pune"
                    value={address}
                    onChangeText={setAddress}
                  />
                </View>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Pincode / Zipcode</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="411001"
                    keyboardType="numeric"
                    value={pincode}
                    onChangeText={setPincode}
                  />
                </View>
              </View>

              {/* Row 6: ID / Passport */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>ID / Aadhaar (Optional)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="XXXX-XXXX-XXXX"
                    value={idNumber}
                    onChangeText={setIdNumber}
                  />
                </View>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Passport No (Optional)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. Z1234567"
                    value={passportNumber}
                    onChangeText={setPassportNumber}
                  />
                </View>
              </View>

              {/* Row 7: DOB & Host */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Date of Birth</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="YYYY-MM-DD"
                    value={dateOfBirth}
                    onChangeText={setDateOfBirth}
                  />
                </View>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Host / Referrer</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Front Desk Staff"
                    value={hostName}
                    onChangeText={setHostName}
                  />
                </View>
              </View>
            </View>

            {/* Section 4: Service Add-ons */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>4. Ancillary Services & Add-ons</Text>
              {services.map((srv) => (
                <TouchableOpacity
                  key={srv.id}
                  style={[
                    styles.serviceItemRow,
                    srv.selected && styles.serviceItemRowActive,
                  ]}
                  onPress={() => toggleService(srv.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.serviceCheckbox}>
                    <Text style={styles.serviceCheckboxText}>
                      {srv.selected ? '✓' : ''}
                    </Text>
                  </View>
                  <View style={styles.serviceTextCol}>
                    <Text style={styles.serviceName}>{srv.name}</Text>
                    <Text style={styles.servicePrice}>+ ₹{srv.price}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Section 5: Financials & Balance */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>5. Folio Financials</Text>

              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>
                  Room Rate ({calculations.nights} Nights × ₹{calculations.basePrice})
                </Text>
                <Text style={styles.financialVal}>
                  ₹{calculations.roomSubtotal.toLocaleString('en-IN')}
                </Text>
              </View>

              {calculations.servicesTotal > 0 ? (
                <View style={styles.financialRow}>
                  <Text style={styles.financialLabel}>Add-on Services Total</Text>
                  <Text style={styles.financialVal}>
                    ₹{calculations.servicesTotal.toLocaleString('en-IN')}
                  </Text>
                </View>
              ) : null}

              <View style={styles.divider} />

              <View style={styles.financialTotalRow}>
                <Text style={styles.totalLabel}>Final Total Amount</Text>
                <Text style={styles.totalValue}>
                  ₹{calculations.netPayable.toLocaleString('en-IN')}
                </Text>
              </View>

              {/* Advance Paid Input */}
              <View style={styles.advanceRow}>
                <View style={styles.advanceInputCol}>
                  <Text style={styles.fieldLabel}>Advance Payment Collected (₹)</Text>
                  <TextInput
                    style={styles.advanceInput}
                    keyboardType="numeric"
                    value={advancePaid}
                    onChangeText={setAdvancePaid}
                    placeholder="0"
                  />
                </View>
              </View>

              {/* High Contrast Red Balance Text */}
              <View style={styles.balanceContainer}>
                <Text style={styles.balanceText}>
                  Balance Due: ₹{calculations.balance.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* Section 6: Notes */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>6. Front Desk Notes / Requests</Text>
              <TextInput
                style={styles.notesInput}
                multiline
                numberOfLines={3}
                placeholder="e.g. Guest arriving late night, requested quiet room on garden side..."
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Bottom Sticky Submit Button */}
      {!successData ? (
        <View style={styles.bottomBar}>
          <View style={styles.bottomPriceCol}>
            <Text style={styles.bottomLabel}>Total Folio</Text>
            <Text style={styles.bottomAmount}>
              ₹{calculations.netPayable.toLocaleString('en-IN')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleBookingSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Confirm & Book Reservation ➔</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Room Picker Modal */}
      <Modal
        visible={showRoomPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRoomPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.roomPickerContent}>
            <View style={styles.roomPickerHeader}>
              <Text style={styles.roomPickerTitle}>Select Available Room</Text>
              <TouchableOpacity
                onPress={() => setShowRoomPicker(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingRooms ? (
              <ActivityIndicator size="large" color="#1e40af" style={{ marginVertical: 20 }} />
            ) : availableRooms.length === 0 ? (
              <Text style={styles.noRoomsText}>
                No rooms available for the selected dates.
              </Text>
            ) : (
              <ScrollView style={styles.roomListScroll}>
                {availableRooms.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.roomPickOption,
                      selectedRoom?.id === r.id && styles.roomPickOptionActive,
                    ]}
                    onPress={() => {
                      setSelectedRoom(r);
                      setShowRoomPicker(false);
                    }}
                  >
                    <View style={styles.roomPickNumBadge}>
                      <Text style={styles.roomPickNumText}>{r.roomNumber}</Text>
                    </View>
                    <View style={styles.roomPickInfoCol}>
                      <Text style={styles.roomPickCatName}>
                        {r.roomCategory?.name || 'Standard'}
                      </Text>
                      <Text style={styles.roomPickStatus}>Status: {r.status}</Text>
                    </View>
                    <Text style={styles.roomPickPrice}>
                      ₹{Number(r.roomCategory?.basePrice || 2500).toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 409 Double-Booking & Room Conflict Popup Modal */}
      <Modal
        visible={!!conflictError}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setConflictError(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.conflictModalCard}>
            <View style={styles.conflictModalIconCircle}>
              <Text style={styles.conflictModalIconText}>🚫</Text>
            </View>

            <Text style={styles.conflictModalTitle}>Room Already Booked</Text>
            <Text style={styles.conflictModalSubtitle}>Double Booking Prevented</Text>

            <View style={styles.conflictModalBodyBox}>
              <Text style={styles.conflictModalBodyText}>{conflictError}</Text>
            </View>

            <View style={styles.conflictModalActions}>
              <TouchableOpacity
                style={styles.conflictModalPrimaryBtn}
                onPress={() => {
                  setConflictError(null);
                  setShowRoomPicker(true);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.conflictModalPrimaryBtnText}>⚡ Assign Available Room</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.conflictModalSecondaryBtn}
                onPress={() => {
                  setConflictError(null);
                  setShowCalendarModal(true);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.conflictModalSecondaryBtnText}>📅 Change Stay Dates</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.conflictModalDismissBtn}
                onPress={() => setConflictError(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.conflictModalDismissBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Google Calendar Interactive Date Picker Dashboard Modal */}
      <GoogleCalendarDatePickerModal
        visible={showCalendarModal}
        checkIn={checkIn}
        checkOut={checkOut}
        existingReservations={existingReservations}
        onClose={() => setShowCalendarModal(false)}
        onApply={(newIn, newOut) => {
          setCheckIn(newIn);
          setCheckOut(newOut);
          setShowCalendarModal(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  // Section Header with G-Cal pill button
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerGCalPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  headerGCalPillIcon: {
    fontSize: 11,
    marginRight: 4,
  },
  headerGCalPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  // Interactive Date Touch Cards
  dateTouchCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 10,
  },
  dateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  inTagMini: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inTagMiniText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1e40af',
  },
  stayNightsTag: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stayNightsTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065f46',
  },
  dateValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  dateCardIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  dateCardValueText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    flexShrink: 1,
  },
  dateTapHint: {
    fontSize: 10,
    color: '#2563eb',
    fontWeight: '600',
    marginTop: 2,
  },
  // Google Calendar Dashboard Banner
  gCalDashboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    ...shadows.card,
  },
  gCalBannerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  gCalBannerIcon: {
    fontSize: 16,
  },
  gCalBannerTextCol: {
    flex: 1,
  },
  gCalBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gCalBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  liveSyncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#10b981',
  },
  liveSyncDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10b981',
    marginRight: 3,
  },
  liveSyncText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#34d399',
  },
  gCalBannerSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  gCalBannerArrow: {
    fontSize: 18,
    color: '#60a5fa',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  // Royal Blue Header
  blueHeader: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backBtnText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '900',
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#93c5fd',
    fontWeight: '600',
    marginTop: 1,
  },
  gCalBadge: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gCalBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 100,
  },
  // Section Cards
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 12,
    ...shadows.card,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  fieldCol: {
    flex: 1,
  },
  fieldFull: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  // Counter Controls
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 7,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  counterBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  counterBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  counterValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  // Room Selection Card
  selectedRoomCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
  },
  selectedRoomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectedRoomNum: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1e40af',
  },
  selectedRoomCat: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
  },
  selectedRoomRate: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1e40af',
  },
  changeRoomLink: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  changeRoomLinkText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
  },
  assignRoomButton: {
    borderWidth: 1.5,
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  assignRoomButtonText: {
    color: '#1e40af',
    fontWeight: '800',
    fontSize: 13,
  },
  // Ancillary Services
  serviceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 7,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  serviceItemRowActive: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  serviceCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#ffffff',
  },
  serviceCheckboxText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#10b981',
  },
  serviceTextCol: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  servicePrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  // Financials
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  financialLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  financialVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 8,
  },
  financialTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  advanceRow: {
    marginBottom: 8,
  },
  advanceInputCol: {
    flex: 1,
  },
  advanceInput: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  balanceContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  balanceText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#dc2626',
    letterSpacing: 0.3,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 7,
    padding: 10,
    fontSize: 12,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    textAlignVertical: 'top',
  },
  // Bottom Bar CTA
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.modal,
  },
  bottomPriceCol: {
    flex: 0.4,
  },
  bottomLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  bottomAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  submitBtn: {
    flex: 0.6,
    backgroundColor: '#1e40af',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  // Modal Common
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  roomPickerContent: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    ...shadows.modal,
  },
  roomPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roomPickerTitle: {
    fontSize: 15,
    fontWeight: '900',
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
  roomListScroll: {
    marginTop: 6,
  },
  roomPickOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  roomPickOptionActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  roomPickNumBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  roomPickNumText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  roomPickInfoCol: {
    flex: 1,
  },
  roomPickCatName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  roomPickStatus: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  roomPickPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1e40af',
  },
  noRoomsText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginVertical: 20,
  },
  // Toasts
  successToast: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    ...shadows.cardHover,
  },
  successIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successIconText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 2,
  },
  successSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 10,
  },
  successSummaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    padding: 10,
    gap: 4,
    marginBottom: 12,
  },
  successSummaryRow: {
    fontSize: 12,
    color: '#ffffff',
  },
  successLabel: {
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  successBtnRow: {
    gap: 8,
  },
  calOpenBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  calOpenBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  returnBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  returnBtnText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '900',
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  whatsappBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  conflictToast: {
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  conflictTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#991b1b',
    marginBottom: 4,
  },
  conflictText: {
    fontSize: 12,
    color: '#b91c1c',
    marginBottom: 10,
  },
  conflictChangeRoomBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  conflictChangeRoomBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  formErrorBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  formErrorText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  // Occupied Room Card Styles
  selectedRoomCardOccupied: {
    backgroundColor: '#fff1f2',
    borderColor: '#f43f5e',
    borderWidth: 1.5,
  },
  selectedRoomNumOccupied: {
    color: '#e11d48',
  },
  selectedRoomRateOccupied: {
    color: '#be123c',
  },
  occupiedBadge: {
    backgroundColor: '#ffe4e6',
    borderColor: '#fda4af',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  occupiedBadgeText: {
    color: '#e11d48',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  occupiedNoticeBox: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    gap: 6,
  },
  occupiedNoticeText: {
    color: '#991b1b',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  occupiedChangeBtn: {
    backgroundColor: '#e11d48',
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
  },
  occupiedChangeBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  // Conflict Popup Modal Styles
  conflictModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    ...shadows.modal,
  },
  conflictModalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#fecaca',
  },
  conflictModalIconText: {
    fontSize: 30,
  },
  conflictModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 2,
    textAlign: 'center',
  },
  conflictModalSubtitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#e11d48',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  conflictModalBodyBox: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    width: '100%',
    marginBottom: 16,
  },
  conflictModalBodyText: {
    fontSize: 13,
    color: '#9f1239',
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  conflictModalActions: {
    width: '100%',
    gap: 8,
  },
  conflictModalPrimaryBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  conflictModalPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  conflictModalSecondaryBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  conflictModalSecondaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  conflictModalDismissBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  conflictModalDismissBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
});


