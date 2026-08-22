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
import { ApiClient } from '../api/client';
import { GoogleCalendarDatePickerModal } from '../components/GoogleCalendarDatePickerModal';
import { colors, borderRadius, shadows } from '../theme';
import { sendWhatsAppConfirmation } from '../utils/whatsapp';

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
  initialCheckIn,
  initialCheckOut,
  onBack,
  onBookingSuccess,
}) => {
  // Helper to format ISO date to DD-MM-YYYY format
  const formatIsoToDdMmYyyy = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const clean = isoStr.slice(0, 10);
      const parts = clean.split('-');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return isoStr;
    } catch {
      return isoStr;
    }
  };

  // Helper to get Today in ISO (YYYY-MM-DD)
  const getTodayIsoStr = () => new Date().toISOString().slice(0, 10);
  const getFutureIsoStr = (startIso?: string, days = 1) => {
    const d = startIso ? new Date(startIso) : new Date();
    if (isNaN(d.getTime())) d.setTime(Date.now());
    const end = new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
    return end.toISOString().slice(0, 10);
  };

  // Stay Dates State
  const [checkIn, setCheckIn] = useState(() => {
    const raw = initialCheckIn ? initialCheckIn.slice(0, 10) : getTodayIsoStr();
    return isNaN(new Date(raw).getTime()) ? getTodayIsoStr() : raw;
  });

  const [checkOut, setCheckOut] = useState(() => {
    const rawIn = initialCheckIn ? initialCheckIn.slice(0, 10) : getTodayIsoStr();
    const rawOut = initialCheckOut ? initialCheckOut.slice(0, 10) : getFutureIsoStr(rawIn, 1);
    const dIn = new Date(rawIn);
    const dOut = new Date(rawOut);
    if (!isNaN(dIn.getTime()) && !isNaN(dOut.getTime()) && dOut.getTime() > dIn.getTime()) {
      return rawOut;
    }
    return getFutureIsoStr(rawIn, 1);
  });

  // Calendar Dashboard Modal & Existing Bookings State
  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);
  const [existingReservations, setExistingReservations] = useState<any[]>([]);

  // Timings & Occupancy
  const [checkInTime, setCheckInTime] = useState('12:00 PM');
  const [checkOutTime, setCheckOutTime] = useState('11:00 AM');
  const [adults, setAdults] = useState<number>(3);
  const [children, setChildren] = useState<number>(0);

  // Dropdown Pickers
  const [showAdultsPicker, setShowAdultsPicker] = useState<boolean>(false);
  const [showChildrenPicker, setShowChildrenPicker] = useState<boolean>(false);
  const [showRoomPicker, setShowRoomPicker] = useState<boolean>(false);

  // Room Selection State (All created rooms)
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(true);
  const [customAmount, setCustomAmount] = useState<string>('');

  // Primary Guest & Optional Fields matching Original Simply PMS Schema
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [hostName, setHostName] = useState('');
  const [hostPhone, setHostPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Ancillary Services
  const [services, setServices] = useState<ServiceAddon[]>([
    { id: 'srv-1', name: 'Airport Transfer', price: 800, selected: false },
    { id: 'srv-2', name: 'Extra Bed / Mattress', price: 500, selected: false },
    { id: 'srv-3', name: 'Laundry Service', price: 300, selected: false },
  ]);
  const [showAddServiceModal, setShowAddServiceModal] = useState<boolean>(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');

  // Advance Payment
  const [advancePaid, setAdvancePaid] = useState<string>('0');

  // Status & Errors
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Load ALL Created Rooms for property from PostgreSQL database
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoadingRooms(true);
        const res = await ApiClient.fetchRoomsData();
        const rawRooms = res.rooms || [];

        const formattedRooms = rawRooms.map((rm: any) => {
          const category = rm.categoryName || 'Standard';
          const roomNum = rm.roomName ? rm.roomName.replace('Room ', '') : rm.roomNumber || rm.roomId;
          return {
            id: rm.roomId || rm.id,
            roomId: rm.roomId || rm.id,
            roomNumber: roomNum,
            categoryName: category,
            displayName: `${category}-${roomNum} - ${category} ${roomNum}`,
            pricePerNight: rm.pricePerNight || 2500,
            status: rm.status,
          };
        });

        setAllRooms(formattedRooms);

        if (formattedRooms.length > 0) {
          if (initialRoomId) {
            const match = formattedRooms.find(
              (r: any) => r.id === initialRoomId || r.roomId === initialRoomId || r.roomNumber === initialRoomNumber
            );
            setSelectedRoom(match || formattedRooms[0]);
          } else if (!selectedRoom) {
            setSelectedRoom(formattedRooms[0]);
          }
        }
      } catch (err) {
        console.warn('Failed to load rooms list:', err);
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchRooms();
  }, [initialRoomId, initialRoomNumber]);

  // Fetch existing reservations for calendar occupancy matrix
  useEffect(() => {
    ApiClient.fetchReservations()
      .then((res) => {
        if (Array.isArray(res)) setExistingReservations(res);
      })
      .catch(() => {});
  }, []);

  // Price Calculations (Nights, Room Price, Services, Total Amount, Advance, Balance)
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

    const roomPrice = customAmount !== '' ? Number(customAmount) || 0 : Number(selectedRoom?.pricePerNight || 2500);
    const roomSubtotal = nights * roomPrice;

    const servicesTotal = services
      .filter((s) => s.selected)
      .reduce((sum, s) => sum + s.price, 0);

    const totalAmount = roomSubtotal + servicesTotal;
    const adv = Number(advancePaid) || 0;
    const balance = Math.max(0, totalAmount - adv);

    return {
      nights,
      roomPrice,
      roomSubtotal,
      servicesTotal,
      totalAmount,
      balance,
    };
  }, [checkIn, checkOut, selectedRoom, customAmount, services, advancePaid]);

  // Add Service Handler
  const handleAddNewService = () => {
    if (!newServiceName.trim() || !newServicePrice.trim()) return;
    const newSrv: ServiceAddon = {
      id: `srv-${Date.now()}`,
      name: newServiceName.trim(),
      price: Number(newServicePrice) || 0,
      selected: true,
    };
    setServices((prev) => [...prev, newSrv]);
    setNewServiceName('');
    setNewServicePrice('');
    setShowAddServiceModal(false);
  };

  // Submit Reservation Handler
  const handleBookingSubmit = async () => {
    const finalGuestName = guestName.trim() || 'Guest';
    const finalGuestPhone = guestPhone.trim() || '+91 9876543210';

    if (!selectedRoom?.id) {
      setFormError('Please select a room for the reservation');
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
        roomId: selectedRoom.id,
        checkIn: checkInIso,
        checkOut: checkOutIso,
        checkInTime,
        checkOutTime,
        adults,
        children,
        totalAmount: calculations.totalAmount,
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
      {/* 1. Solid Blue Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Reservation / Booking</Text>
      </View>

      {/* Main Form Scroll View */}
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Success Modal Card */}
        {successData ? (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>🎉</Text>
            <Text style={styles.successTitle}>Booking Confirmed!</Text>
            <Text style={styles.successSub}>
              Reservation for <Text style={{ fontWeight: '800' }}>{guestName || 'Guest'}</Text> has been created in PostgreSQL backend.
            </Text>

            <TouchableOpacity
              style={styles.whatsappBtn}
              onPress={() => {
                sendWhatsAppConfirmation({
                  guestName: guestName || 'Guest',
                  guestPhone: guestPhone || '',
                  roomName: selectedRoom?.name || selectedRoom?.roomNumber || 'Room',
                  checkIn: formatIsoToDdMmYyyy(checkIn),
                  checkOut: formatIsoToDdMmYyyy(checkOut),
                  totalAmount: calculations.totalAmount,
                  advancePaid: Number(advancePaid) || 0,
                  balanceAmount: calculations.balance,
                  bookingId: successData?.bookingId || successData?.id,
                });
                if (successData?.id) {
                  ApiClient.sendWhatsAppNotification(successData.id).catch(() => {});
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.whatsappBtnText}>💬 Send WhatsApp Confirmation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => onBookingSuccess(successData.id, checkIn)}
            >
              <Text style={styles.doneBtnText}>View Bookings List</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Error Banners */}
            {conflictError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️ {conflictError}</Text>
              </View>
            )}
            {formError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️ {formError}</Text>
              </View>
            )}

            {/* TOP ROW 1: Check in * & Check out * */}
            <View style={styles.twoColRow}>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>Check in *</Text>
                <TouchableOpacity
                  style={styles.pickerBox}
                  onPress={() => setShowCalendarModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pickerText}>{formatIsoToDdMmYyyy(checkIn)}</Text>
                  <Text style={styles.pickerIcon}>📅</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>Check out *</Text>
                <TouchableOpacity
                  style={styles.pickerBox}
                  onPress={() => setShowCalendarModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pickerText}>{formatIsoToDdMmYyyy(checkOut)}</Text>
                  <Text style={styles.pickerIcon}>📅</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* TOP ROW 2: Check-in Time & Check-out Time */}
            <View style={styles.twoColRow}>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>Check-in Time</Text>
                <View style={styles.pickerBox}>
                  <TextInput
                    style={styles.inputInner}
                    value={checkInTime}
                    onChangeText={setCheckInTime}
                    placeholder="12:00 PM"
                  />
                  <Text style={styles.pickerIcon}>🕒</Text>
                </View>
              </View>

              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>Check-out Time</Text>
                <View style={styles.pickerBox}>
                  <TextInput
                    style={styles.inputInner}
                    value={checkOutTime}
                    onChangeText={setCheckOutTime}
                    placeholder="11:00 AM"
                  />
                  <Text style={styles.pickerIcon}>🕒</Text>
                </View>
              </View>
            </View>

            {/* TOP ROW 3: Adults * & Children */}
            <View style={styles.twoColRow}>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>Adults *</Text>
                <TouchableOpacity
                  style={styles.pickerBox}
                  onPress={() => setShowAdultsPicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pickerText}>{adults}</Text>
                  <Text style={styles.pickerIcon}>∨</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>Children</Text>
                <TouchableOpacity
                  style={styles.pickerBox}
                  onPress={() => setShowChildrenPicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pickerText}>{children}</Text>
                  <Text style={styles.pickerIcon}>∨</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ROOM ASSIGNMENT CARD */}
            <View style={styles.roomCardContainer}>
              <View style={styles.minusBtnBox}>
                <Text style={styles.minusBtnText}>-</Text>
              </View>

              {/* Room name * */}
              <View style={{ marginTop: 4 }}>
                <Text style={styles.fieldLabel}>Room name *</Text>
                <TouchableOpacity
                  style={[styles.pickerBox, styles.blueActiveBorder]}
                  onPress={() => setShowRoomPicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pickerText} numberOfLines={1}>
                    {selectedRoom
                      ? selectedRoom.displayName || `${selectedRoom.categoryName} - Room ${selectedRoom.roomNumber}`
                      : loadingRooms
                      ? 'Loading created rooms...'
                      : 'Select Created Room'}
                  </Text>
                  <Text style={styles.pickerIcon}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* Amount(Incl. of taxes) */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>Amount(Incl. of taxes)</Text>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="numeric"
                  placeholder={`${selectedRoom?.pricePerNight || 2500}`}
                  value={customAmount}
                  onChangeText={setCustomAmount}
                />
                <Text style={styles.totalAmountLabel}>
                  Total Amount: ₹{calculations.totalAmount.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Outlined + Assign Another Room Button */}
            <TouchableOpacity
              style={styles.assignAnotherRoomBtn}
              onPress={() => setShowRoomPicker(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.assignAnotherRoomBtnText}>+ Assign Another Room</Text>
            </TouchableOpacity>

            {/* GUEST DETAILS SECTION */}
            <View style={{ marginTop: 16 }}>
              {/* Primary Guest Name * & Contact Number * */}
              <View style={styles.twoColRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Primary Guest Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={guestName}
                    onChangeText={setGuestName}
                    placeholder="Enter guest name"
                  />
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Contact Number *</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="phone-pad"
                    value={guestPhone}
                    onChangeText={setGuestPhone}
                    placeholder="+91 9876543210"
                  />
                </View>
              </View>

              {/* E-mail (optional) */}
              <View style={styles.fullWidthField}>
                <Text style={styles.fieldLabel}>E-mail (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={guestEmail}
                  onChangeText={setGuestEmail}
                  placeholder="Enter email address"
                />
              </View>

              {/* Address (optional) & Pincode/Zipcode (optional) */}
              <View style={styles.twoColRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Address (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Street / City"
                  />
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Pincode/Zipcode (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={pincode}
                    onChangeText={setPincode}
                    placeholder="411001"
                  />
                </View>
              </View>

              {/* ID Number (optional) & Passport Number (optional) */}
              <View style={styles.twoColRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>ID Number (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={idNumber}
                    onChangeText={setIdNumber}
                    placeholder="Aadhaar / Voter ID"
                  />
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Passport Number (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={passportNumber}
                    onChangeText={setPassportNumber}
                    placeholder="Passport No"
                  />
                </View>
              </View>

              {/* Date of Birth (optional) */}
              <View style={styles.fullWidthField}>
                <Text style={styles.fieldLabel}>Date of Birth (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="DD-MM-YYYY"
                />
              </View>

              {/* Host Name (optional) & Host Phone (optional) */}
              <View style={styles.twoColRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Host Name (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={hostName}
                    onChangeText={setHostName}
                    placeholder="Host name"
                  />
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Host Phone (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="phone-pad"
                    value={hostPhone}
                    onChangeText={setHostPhone}
                    placeholder="Host phone"
                  />
                </View>
              </View>

              {/* + Add service Button */}
              <TouchableOpacity
                style={styles.assignAnotherRoomBtn}
                onPress={() => setShowAddServiceModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.assignAnotherRoomBtnText}>+ Add service</Text>
              </TouchableOpacity>

              {/* Additional Services List if any selected */}
              {services.some((s) => s.selected) && (
                <View style={styles.servicesBox}>
                  {services
                    .filter((s) => s.selected)
                    .map((s) => (
                      <View key={s.id} style={styles.serviceItemRow}>
                        <Text style={styles.serviceItemName}>✓ {s.name}</Text>
                        <Text style={styles.serviceItemPrice}>+₹{s.price}</Text>
                      </View>
                    ))}
                </View>
              )}

              {/* Section Header: Additional Guests */}
              <Text style={styles.sectionHeaderTitle}>Additional Guests</Text>

              {/* Advance Paid */}
              <View style={styles.fullWidthField}>
                <Text style={styles.fieldLabel}>Advance Paid (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={advancePaid}
                  onChangeText={setAdvancePaid}
                  placeholder="0"
                />
              </View>

              {/* FINANCIAL BREAKDOWN CARD (Showing Balance Due) */}
              <View style={styles.financialSummaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Amount:</Text>
                  <Text style={styles.summaryValue}>₹{calculations.totalAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Advance Paid:</Text>
                  <Text style={styles.summaryValue}>₹{(Number(advancePaid) || 0).toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.balanceRow]}>
                  <Text style={styles.balanceLabel}>Balance Due:</Text>
                  <Text style={styles.balanceValue}>₹{calculations.balance.toFixed(2)}</Text>
                </View>
              </View>

              {/* Notes / Special Requests (optional) */}
              <View style={styles.fullWidthField}>
                <Text style={styles.fieldLabel}>Notes / Special Requests (optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.notesInput]}
                  multiline
                  numberOfLines={3}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Enter any guest notes, special requests, or instructions..."
                />
              </View>

              {/* Save / Create Reservation Button */}
              <TouchableOpacity
                style={[styles.saveBookingBtn, submitting && styles.btnDisabled]}
                onPress={handleBookingSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBookingBtnText}>Create Reservation / Booking</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Calendar Date Picker Modal */}
      <GoogleCalendarDatePickerModal
        visible={showCalendarModal}
        checkIn={checkIn}
        checkOut={checkOut}
        existingReservations={existingReservations}
        onClose={() => setShowCalendarModal(false)}
        onApply={(newIn: string, newOut: string) => {
          setCheckIn(newIn);
          setCheckOut(newOut);
          setShowCalendarModal(false);
        }}
      />

      {/* Room Picker Modal (All Created Rooms) */}
      <Modal
        visible={showRoomPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRoomPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Created Room</Text>
              <TouchableOpacity onPress={() => setShowRoomPicker(false)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              {allRooms.map((rm) => (
                <TouchableOpacity
                  key={rm.id}
                  style={[
                    styles.modalOptionRow,
                    selectedRoom?.id === rm.id && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedRoom(rm);
                    setShowRoomPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      selectedRoom?.id === rm.id && styles.modalOptionTextSelected,
                    ]}
                  >
                    {rm.displayName || `${rm.categoryName} - Room ${rm.roomNumber}`}
                  </Text>
                  <Text style={styles.roomPriceTag}>₹{rm.pricePerNight}/night</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Adults Picker Modal */}
      <Modal
        visible={showAdultsPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAdultsPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Adults Count</Text>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
              <TouchableOpacity
                key={num}
                style={styles.modalOptionRow}
                onPress={() => {
                  setAdults(num);
                  setShowAdultsPicker(false);
                }}
              >
                <Text style={styles.modalOptionText}>{num} Adult{num > 1 ? 's' : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Children Picker Modal */}
      <Modal
        visible={showChildrenPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowChildrenPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Children Count</Text>
            {[0, 1, 2, 3, 4, 5].map((num) => (
              <TouchableOpacity
                key={num}
                style={styles.modalOptionRow}
                onPress={() => {
                  setChildren(num);
                  setShowChildrenPicker(false);
                }}
              >
                <Text style={styles.modalOptionText}>{num} Child{num !== 1 ? 'ren' : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>



      {/* Add Service Modal */}
      <Modal
        visible={showAddServiceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddServiceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Service</Text>
              <TouchableOpacity onPress={() => setShowAddServiceModal(false)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Service Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Extra Bed"
              value={newServiceName}
              onChangeText={setNewServiceName}
            />

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Price (₹)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              placeholder="500"
              value={newServicePrice}
              onChangeText={setNewServicePrice}
            />

            <TouchableOpacity
              style={[styles.saveBookingBtn, { marginTop: 16 }]}
              onPress={handleAddNewService}
            >
              <Text style={styles.saveBookingBtnText}>Add Service</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#0066FF',
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadows.card,
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
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  colHalf: {
    flex: 1,
  },
  colLarge: {
    flex: 2.2,
  },
  colSmall: {
    flex: 1,
  },
  fullWidthField: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 4,
  },
  pickerBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  pickerIcon: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  inputInner: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    padding: 0,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  roomCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    ...shadows.card,
  },
  minusBtnBox: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  minusBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4B5563',
  },
  blueActiveBorder: {
    borderColor: '#0066FF',
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  amountInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937',
    marginTop: 2,
  },
  totalAmountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  assignAnotherRoomBtn: {
    borderWidth: 1,
    borderColor: '#0066FF',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  assignAnotherRoomBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0066FF',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 12,
  },

  // Financial Summary Card (Showing Balance Due)
  financialSummaryCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#78350F',
  },
  balanceRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#FCD34D',
    marginBottom: 0,
  },
  balanceLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: '#B45309',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#B45309',
  },

  saveBookingBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    ...shadows.card,
  },
  saveBookingBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  servicesBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  serviceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  serviceItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
  },
  serviceItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E40AF',
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 40,
    ...shadows.card,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  whatsappBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  doneBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    ...shadows.modal,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 10,
  },
  modalCloseIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6B7280',
  },
  modalOptionRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  modalOptionTextSelected: {
    color: '#0066FF',
    fontWeight: '800',
  },
  roomPriceTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
});
