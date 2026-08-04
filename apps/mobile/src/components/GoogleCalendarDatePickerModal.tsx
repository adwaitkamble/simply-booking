import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Dimensions,
} from 'react-native';
import { colors, borderRadius, shadows } from '../theme';

interface GoogleCalendarDatePickerModalProps {
  visible: boolean;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  onClose: () => void;
  onApply: (checkIn: string, checkOut: string) => void;
  existingReservations?: { checkIn: string; checkOut: string; guestName?: string }[];
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const GoogleCalendarDatePickerModal: React.FC<GoogleCalendarDatePickerModalProps> = ({
  visible,
  checkIn,
  checkOut,
  onClose,
  onApply,
  existingReservations = [],
}) => {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tomorrowStr = useMemo(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10), []);

  // Temporary selection state during modal open
  const [selectedIn, setSelectedIn] = useState<string>(checkIn || todayStr);
  const [selectedOut, setSelectedOut] = useState<string>(checkOut || tomorrowStr);

  // Currently viewed month in the calendar dashboard
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (checkIn && checkIn.length >= 10) {
      const d = new Date(checkIn.slice(0, 10));
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // Sync state whenever modal becomes visible
  React.useEffect(() => {
    if (visible) {
      const currentToday = new Date().toISOString().slice(0, 10);
      const currentTomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const cleanIn = checkIn?.slice(0, 10) || currentToday;
      const cleanOut = checkOut?.slice(0, 10) || currentTomorrow;
      setSelectedIn(cleanIn < currentToday ? currentToday : cleanIn);
      setSelectedOut(cleanOut < currentTomorrow ? currentTomorrow : cleanOut);

      const d = new Date(cleanIn < currentToday ? currentToday : cleanIn);
      if (!isNaN(d.getTime())) {
        setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  }, [visible, checkIn, checkOut]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  // Generate calendar grid cells
  const calendarGrid = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: {
      dayNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isCheckIn: boolean;
      isCheckOut: boolean;
      isInRange: boolean;
      hasBooking: boolean;
    }[] = [];

    const todayStr = new Date().toISOString().slice(0, 10);

    // Format YYYY-MM-DD
    const makeDateStr = (y: number, m: number, d: number) => {
      const mm = String(m + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    };

    // 1. Prev month trailing days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = makeDateStr(prevY, prevM, d);
      cells.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isCheckIn: dateStr === selectedIn,
        isCheckOut: dateStr === selectedOut,
        isInRange: Boolean(selectedIn && selectedOut && dateStr > selectedIn && dateStr < selectedOut),
        hasBooking: false,
      });
    }

    // 2. Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = makeDateStr(viewYear, viewMonth, d);
      const isCheckIn = dateStr === selectedIn;
      const isCheckOut = dateStr === selectedOut;
      const isInRange = Boolean(selectedIn && selectedOut && dateStr > selectedIn && dateStr < selectedOut);

      // Check if any existing reservation overlaps this day
      const hasBooking = existingReservations.some((r) => {
        const rIn = r.checkIn?.slice(0, 10);
        const rOut = r.checkOut?.slice(0, 10);
        return rIn && rOut && dateStr >= rIn && dateStr < rOut;
      });

      cells.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isCheckIn,
        isCheckOut,
        isInRange,
        hasBooking,
      });
    }

    // 3. Next month leading days to fill full 35 or 42 grid
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = makeDateStr(nextY, nextM, d);
      cells.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isCheckIn: dateStr === selectedIn,
        isCheckOut: dateStr === selectedOut,
        isInRange: Boolean(selectedIn && selectedOut && dateStr > selectedIn && dateStr < selectedOut),
        hasBooking: false,
      });
    }

    return cells;
  }, [viewYear, viewMonth, selectedIn, selectedOut, existingReservations]);

  // Handle day click
  const handleDateClick = (dateStr: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dateStr < todayStr) {
      return; // Ignore past dates click
    }

    if (!selectedIn || (selectedIn && selectedOut)) {
      // Start a new range
      setSelectedIn(dateStr);
      setSelectedOut('');
    } else if (selectedIn && !selectedOut) {
      if (dateStr > selectedIn) {
        setSelectedOut(dateStr);
      } else if (dateStr < selectedIn) {
        // Tapped earlier date, restart check-in
        setSelectedIn(dateStr);
      } else {
        // Tapped same date, default 1 night
        const d = new Date(dateStr);
        d.setDate(d.getDate() + 1);
        setSelectedOut(d.toISOString().slice(0, 10));
      }
    }
  };

  // Quick Presets
  const applyPreset = (daysFromToday: number, durationNights: number) => {
    const base = new Date();
    base.setDate(base.getDate() + daysFromToday);
    const inStr = base.toISOString().slice(0, 10);

    const outDate = new Date(base);
    outDate.setDate(outDate.getDate() + durationNights);
    const outStr = outDate.toISOString().slice(0, 10);

    setSelectedIn(inStr);
    setSelectedOut(outStr);
    setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
  };

  // Preset: This Weekend (Friday to Sunday)
  const applyWeekendPreset = () => {
    const now = new Date();
    const day = now.getDay(); // 0 is Sun, 5 is Fri
    const diffToFri = (5 - day + 7) % 7;
    const friday = new Date(now);
    friday.setDate(now.getDate() + (diffToFri === 0 ? 7 : diffToFri));

    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);

    const inStr = friday.toISOString().slice(0, 10);
    const outStr = sunday.toISOString().slice(0, 10);

    setSelectedIn(inStr);
    setSelectedOut(outStr);
    setViewDate(new Date(friday.getFullYear(), friday.getMonth(), 1));
  };

  // Preset: Next Dec 2026 Dates
  const applyDecPreset = (startDay: number, nights: number) => {
    const inStr = `2026-12-${String(startDay).padStart(2, '0')}`;
    const dOut = new Date(`2026-12-${String(startDay).padStart(2, '0')}`);
    dOut.setDate(dOut.getDate() + nights);
    const outStr = dOut.toISOString().slice(0, 10);

    setSelectedIn(inStr);
    setSelectedOut(outStr);
    setViewDate(new Date(2026, 11, 1));
  };

  // Stay calculations
  const stayInfo = useMemo(() => {
    if (!selectedIn) return { nights: 0, text: 'Select Check-In Date' };
    if (!selectedOut) return { nights: 1, text: 'Select Check-Out Date' };

    const d1 = new Date(selectedIn);
    const d2 = new Date(selectedOut);
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    const nights = Math.max(1, diff);

    const formatShort = (s: string) => {
      try {
        const d = new Date(s);
        return d.toLocaleDateString('en-US', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
      } catch {
        return s;
      }
    };

    return {
      nights,
      text: `${formatShort(selectedIn)} ➔ ${formatShort(selectedOut)} (${nights} Night${nights > 1 ? 's' : ''})`,
    };
  }, [selectedIn, selectedOut]);

  const handleConfirm = () => {
    if (!selectedIn) return;
    let finalOut = selectedOut;
    if (!finalOut || finalOut <= selectedIn) {
      const d = new Date(selectedIn);
      d.setDate(d.getDate() + 1);
      finalOut = d.toISOString().slice(0, 10);
    }
    onApply(selectedIn, finalOut);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* 1. Header with Google Calendar Live Badge */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.gCalPill}>
                <Text style={styles.gCalIcon}>📅</Text>
                <Text style={styles.gCalPillText}>GOOGLE CALENDAR SYNC</Text>
              </View>
              <TouchableOpacity
                style={styles.openGCalBtn}
                onPress={() => Linking.openURL('https://calendar.google.com')}
                activeOpacity={0.7}
              >
                <Text style={styles.openGCalText}>Open G-Cal ↗</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.headerTitle}>Select Stay Dates</Text>
            <Text style={styles.headerSubtitle}>
              The Royal Maratha Resort • Pune Management Grid
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* 2. Quick Preset Pills */}
            <View style={styles.presetSection}>
              <Text style={styles.presetLabel}>QUICK PRESETS:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={() => applyPreset(0, 2)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetPillText}>Next 2 Nights</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={() => applyPreset(3, 2)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetPillText}>Next Week (2N)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={applyWeekendPreset}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetPillText}>Upcoming Weekend</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={() => applyPreset(0, 1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetPillText}>Today (1N)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={() => applyPreset(1, 3)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetPillText}>Tomorrow (3N)</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* 3. Month Navigator Bar */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={handlePrevMonth}
                activeOpacity={0.7}
              >
                <Text style={styles.monthNavArrow}>‹</Text>
              </TouchableOpacity>

              <View style={styles.monthTitleWrapper}>
                <Text style={styles.monthTitleText}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </Text>
                <TouchableOpacity onPress={handleJumpToToday} style={styles.todayMiniBtn}>
                  <Text style={styles.todayMiniText}>CURRENT</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={handleNextMonth}
                activeOpacity={0.7}
              >
                <Text style={styles.monthNavArrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* 4. Weekday Headers (SUN to SAT) */}
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((w, idx) => (
                <Text
                  key={w}
                  style={[
                    styles.weekdayText,
                    (idx === 0 || idx === 6) && styles.weekdayWeekend,
                  ]}
                >
                  {w}
                </Text>
              ))}
            </View>

            {/* 5. 7-Column Interactive Days Grid */}
            <View style={styles.calendarGrid}>
              {calendarGrid.map((cell, idx) => {
                const isSelected = cell.isCheckIn || cell.isCheckOut;
                const todayStr = new Date().toISOString().slice(0, 10);
                const isPast = cell.dateStr < todayStr;

                return (
                  <TouchableOpacity
                    key={`${cell.dateStr}-${idx}`}
                    style={[
                      styles.dayCell,
                      cell.isInRange && styles.dayCellInRange,
                      cell.isCheckIn && styles.dayCellCheckIn,
                      cell.isCheckOut && styles.dayCellCheckOut,
                      isPast && styles.dayCellPast,
                    ]}
                    onPress={() => handleDateClick(cell.dateStr)}
                    activeOpacity={isPast ? 1.0 : 0.7}
                    disabled={isPast}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        cell.isToday && styles.dayCircleToday,
                        cell.isCheckIn && styles.dayCircleCheckIn,
                        cell.isCheckOut && styles.dayCircleCheckOut,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumText,
                          !cell.isCurrentMonth && styles.dayNumDimmed,
                          cell.isToday && styles.dayNumToday,
                          isSelected && styles.dayNumSelected,
                          isPast && styles.dayNumPast,
                        ]}
                      >
                        {cell.dayNum}
                      </Text>
                    </View>

                    {/* Tag for Check-In or Check-Out */}
                    {cell.isCheckIn ? (
                      <Text style={styles.dateTagIn}>IN</Text>
                    ) : cell.isCheckOut ? (
                      <Text style={styles.dateTagOut}>OUT</Text>
                    ) : cell.hasBooking ? (
                      <View style={styles.bookedDot} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 6. Selected Stay Window Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>CHECK-IN</Text>
                  <Text style={styles.summaryDateVal}>
                    {selectedIn || 'Not Selected'}
                  </Text>
                </View>

                <View style={styles.summaryDivider}>
                  <Text style={styles.summaryNightsCount}>
                    {stayInfo.nights} {stayInfo.nights === 1 ? 'NIGHT' : 'NIGHTS'}
                  </Text>
                  <Text style={styles.summaryArrow}>➔</Text>
                </View>

                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>CHECK-OUT</Text>
                  <Text style={styles.summaryDateVal}>
                    {selectedOut || 'Tap next date'}
                  </Text>
                </View>
              </View>

              <View style={styles.gCalSyncNoteRow}>
                <View style={styles.syncDot} />
                <Text style={styles.gCalSyncNote}>
                  Auto-synchronizes with Google Calendar & Locks Room
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* 7. Bottom Action Bar */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.applyBtn,
                !selectedIn && styles.applyBtnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!selectedIn}
              activeOpacity={0.85}
            >
              <Text style={styles.applyBtnText}>Apply Stay Dates ✓</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 24,
    ...shadows.modal,
  },
  header: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gCalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  gCalIcon: {
    fontSize: 12,
    marginRight: 5,
  },
  gCalPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#60a5fa',
    letterSpacing: 0.5,
  },
  openGCalBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1e293b',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#475569',
  },
  openGCalText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  // Presets
  presetSection: {
    marginBottom: 14,
  },
  presetLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  presetScroll: {
    flexDirection: 'row',
  },
  presetPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  // Month Navigation
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  monthNavArrow: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    lineHeight: 22,
  },
  monthTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginRight: 8,
  },
  todayMiniBtn: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  todayMiniText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  // Weekday row
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  weekdayWeekend: {
    color: '#ef4444',
  },
  // Days grid
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  dayCell: {
    width: '14.28%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    position: 'relative',
  },
  dayCellInRange: {
    backgroundColor: '#eff6ff',
    borderRadius: 0,
  },
  dayCellCheckIn: {
    backgroundColor: '#dbeafe',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  dayCellCheckOut: {
    backgroundColor: '#dbeafe',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: '#3b82f6',
  },
  dayCircleCheckIn: {
    backgroundColor: '#1e40af',
  },
  dayCircleCheckOut: {
    backgroundColor: '#059669',
  },
  dayNumText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  dayNumDimmed: {
    color: '#cbd5e1',
    fontWeight: '500',
  },
  dayNumToday: {
    color: '#2563eb',
    fontWeight: '900',
  },
  dayNumSelected: {
    color: '#ffffff',
    fontWeight: '900',
  },
  dayCellPast: {
    backgroundColor: 'transparent',
    opacity: 0.25,
  },
  dayNumPast: {
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  dateTagIn: {
    position: 'absolute',
    bottom: 2,
    fontSize: 8,
    fontWeight: '900',
    color: '#1e40af',
  },
  dateTagOut: {
    position: 'absolute',
    bottom: 2,
    fontSize: 8,
    fontWeight: '900',
    color: '#059669',
  },
  bookedDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f59e0b',
  },
  // Summary Card
  summaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCol: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryDateVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryDivider: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  summaryNightsCount: {
    fontSize: 10,
    fontWeight: '900',
    color: '#2563eb',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  summaryArrow: {
    fontSize: 12,
    color: '#64748b',
  },
  gCalSyncNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  gCalSyncNote: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  // Footer
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  applyBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
