import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { sendWhatsAppInvoice } from '../utils/whatsapp';
import type {
  InvoiceDTO,
  InvoiceItemCategory,
  AncillaryItemInput,
} from '@hotel-pms/types';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { Badge } from '../components/Badge';
import { Header } from '../components/Header';
import { colors, typography, borderRadius, shadows } from '../theme';

interface InvoiceScreenProps {
  initialReservationId?: string;
  onBack?: () => void;
}

export const InvoiceScreen: React.FC<InvoiceScreenProps> = ({
  initialReservationId = '',
  onBack,
}) => {
  const { property } = useAuth();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loadingReservations, setLoadingReservations] = useState<boolean>(true);
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CHECKED_OUT'>('ALL');

  // Invoice & Billing State
  const [invoice, setInvoice] = useState<InvoiceDTO | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState<boolean>(false);
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('UPI');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Ancillary charges input
  const [ancillaryDesc, setAncillaryDesc] = useState('');
  const [ancillaryAmount, setAncillaryAmount] = useState('');
  const [ancillaryCategory, setAncillaryCategory] = useState<InvoiceItemCategory>('FoodAndBeverage');
  const [ancillaryList, setAncillaryList] = useState<AncillaryItemInput[]>([]);

  // 1. Fetch Reservations on mount
  useEffect(() => {
    loadReservations();
  }, []);

  const loadReservations = async () => {
    try {
      setLoadingReservations(true);
      const data = await ApiClient.fetchReservations();
      if (Array.isArray(data)) {
        setReservations(data);
        // Pre-select if initialReservationId provided
        if (initialReservationId) {
          const match = data.find((r) => r.id === initialReservationId);
          if (match) {
            handleSelectReservation(match);
          }
        } else if (data.length > 0 && !selectedReservation) {
          handleSelectReservation(data[0]);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load reservations:', err);
    } finally {
      setLoadingReservations(false);
    }
  };

  // 2. Select a reservation and auto-fetch or generate its invoice
  const handleSelectReservation = async (resItem: any) => {
    setSelectedReservation(resItem);
    setError(null);
    setSuccessMessage(null);
    setAncillaryList([]);

    try {
      setLoadingInvoice(true);
      // Check if a paid/settled invoice already exists
      try {
        const existing = await ApiClient.fetchInvoiceByReservation(resItem.id);
        if (existing && existing.status === 'Paid') {
          setInvoice(existing);
          return;
        }
      } catch {
        // No existing invoice found yet
      }

      // Generate / refresh invoice for this stay to ensure accurate GST-inclusive rates
      const generated = await ApiClient.generateInvoice({
        reservationId: resItem.id,
        ancillaryItems: [],
      });
      setInvoice(generated);
    } catch (err: any) {
      setError(err.message || 'Failed to load folio for reservation');
    } finally {
      setLoadingInvoice(false);
    }
  };

  // 3. Computed Stay & Financial Details
  const stayMetrics = useMemo(() => {
    const res = selectedReservation || invoice?.reservation;
    if (!res) {
      return {
        nights: 1,
        dailyRate: 0,
        advancePaid: 0,
        settlementAmount: 0,
        balanceDue: 0,
        grossAmount: 0,
      };
    }

    let nights = 1;
    try {
      const d1 = new Date(res.checkIn);
      const d2 = new Date(res.checkOut);
      const diffDays = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      nights = Math.max(1, diffDays);
    } catch {
      nights = 1;
    }

    // Extract agreedTotal and advancePaid from any potential shape (root, financials, reservation relation)
    const agreedTotal = Number(
      res.totalAmount ??
      res.financials?.totalAmount ??
      invoice?.reservation?.totalAmount ??
      0
    ) || 0;

    const advancePaid = Number(
      res.advancePaid ??
      res.financials?.advancePaid ??
      invoice?.reservation?.advancePaid ??
      0
    ) || 0;

    // Gross amount from invoice (inclusive of GST and any add-ons) or agreed stay total
    const grossAmount = invoice ? Number(invoice.grandTotal) : agreedTotal;
    const dailyRate = Math.round((grossAmount / nights) * 100) / 100;

    // Settlement amount is the net bill to settle: Total Gross Amount - Advance Paid
    const settlementAmount = Math.max(0, Math.round((grossAmount - advancePaid) * 100) / 100);
    const balanceDue = invoice?.status === 'Paid' ? 0 : settlementAmount;

    return {
      nights,
      dailyRate,
      advancePaid,
      settlementAmount,
      balanceDue,
      grossAmount,
    };
  }, [selectedReservation, invoice]);

  // 4. Filtered list of reservations
  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const guestName = (r.guest?.name || r.guestName || '').toLowerCase();
      const phone = (r.guest?.phone || r.guestPhone || '').toLowerCase();
      const roomNum = String(r.room?.roomNumber || r.roomNumber || '').toLowerCase();

      const matchesSearch = !q || guestName.includes(q) || phone.includes(q) || roomNum.includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'ACTIVE') {
        return r.status === 'CheckedIn' || r.status === 'Confirmed';
      }
      if (statusFilter === 'CHECKED_OUT') {
        return r.status === 'CheckedOut';
      }
      return true;
    });
  }, [reservations, searchQuery, statusFilter]);

  // 5. Add Ancillary Charge
  const handleAddAncillary = () => {
    const amt = parseFloat(ancillaryAmount);
    if (!ancillaryDesc.trim() || isNaN(amt) || amt <= 0) {
      setError('Please provide a valid description and positive amount for the add-on');
      return;
    }

    setAncillaryList((prev) => [
      ...prev,
      {
        description: ancillaryDesc.trim(),
        amount: amt,
        quantity: 1,
        category: ancillaryCategory,
      },
    ]);

    setAncillaryDesc('');
    setAncillaryAmount('');
    setError(null);
  };

  const handleRemoveAncillary = (index: number) => {
    setAncillaryList((prev) => prev.filter((_, i) => i !== index));
  };

  // 6. Recalculate / Update Folio Bill with Ancillary items
  const handleRecalculateFolio = async () => {
    if (!selectedReservation) return;

    try {
      setLoadingInvoice(true);
      setError(null);
      setSuccessMessage(null);

      const generated = await ApiClient.generateInvoice({
        reservationId: selectedReservation.id,
        ancillaryItems: ancillaryList,
      });

      setInvoice(generated);
      setSuccessMessage('Folio updated successfully with room stay and ancillary items (GST inclusive).');
    } catch (err: any) {
      setError(err.message || 'Failed to update invoice');
    } finally {
      setLoadingInvoice(false);
    }
  };

  // 7. Settle Payment & Complete Checkout
  const handlePayInvoice = async () => {
    if (!invoice) return;

    try {
      setSubmittingPayment(true);
      setError(null);

      const paidInvoice = await ApiClient.payInvoice(invoice.id);
      setInvoice(paidInvoice);
      setSuccessMessage(`✓ Bill fully settled via ${paymentMethod}! Guest marked as CheckedOut.`);

      // Refresh reservations list status
      loadReservations();
    } catch (err: any) {
      setError(err.message || 'Payment settlement failed');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // 8. Generate & Download / Share PDF Bill
  const handleGeneratePdf = async () => {
    if (!invoice || !selectedReservation) {
      Alert.alert('Invoice Required', 'Please generate or select an invoice first.');
      return;
    }

    try {
      setGeneratingPdf(true);
      const propName = property?.name || 'Simply Booking Hotel';
      const propCity = property?.city || 'Pune, India';
      const propAddress = property?.address || 'Hotel Premises';
      const guestName = selectedReservation.guest?.name || selectedReservation.guestName || 'Valued Guest';
      const guestPhone = selectedReservation.guest?.phone || selectedReservation.guestPhone || '—';
      const guestEmail = selectedReservation.guest?.email || selectedReservation.guestEmail || '—';
      const roomNum = selectedReservation.room?.roomNumber || '—';
      const roomCat = selectedReservation.room?.roomCategory?.name || 'Standard';

      const checkInDate = new Date(selectedReservation.checkIn).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const checkOutDate = new Date(selectedReservation.checkOut).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const invoiceNo = `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
      const invoiceDate = new Date(invoice.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const gross = Number(invoice.grandTotal);
      const taxable = Number(invoice.subtotal);
      const totalTax = Number(invoice.taxAmount);
      const cgst = Math.round((totalTax / 2) * 100) / 100;
      const sgst = Math.round((totalTax - cgst) * 100) / 100;
      const adv = stayMetrics.advancePaid;
      const settlement = stayMetrics.settlementAmount;
      const bal = invoice.status === 'Paid' ? 0 : stayMetrics.balanceDue;

      const itemsRowsHtml = (invoice.items || [])
        .map(
          (it, idx) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #64748B;">${idx + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #0F172A;">
            ${it.description}
            <div style="font-size: 11px; color: #64748B;">SAC: ${it.category === 'Room' ? '996311' : it.category === 'FoodAndBeverage' ? '996331' : '9996'}</div>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #0F172A;">${it.quantity || 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700; color: #0F172A;">₹${Number(it.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `
        )
        .join('');

      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Tax Invoice - ${invoiceNo}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; margin: 0; padding: 0; }
          .invoice-box { max-width: 800px; margin: auto; padding: 24px; border: 1px solid #CBD5E1; border-radius: 8px; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .brand-title { font-size: 24px; font-weight: 800; color: #0F172A; }
          .brand-sub { font-size: 12px; color: #64748B; margin-top: 4px; }
          .tax-badge { display: inline-block; background: #0F172A; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.5px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #F8FAFC; border-radius: 6px; }
          .info-table td { padding: 12px 16px; vertical-align: top; font-size: 12px; }
          .info-label { font-weight: 700; color: #64748B; text-transform: uppercase; font-size: 10px; margin-bottom: 4px; }
          .info-val { font-size: 13px; font-weight: 600; color: #0F172A; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .items-table th { background: #F1F5F9; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 10px; border-bottom: 2px solid #CBD5E1; }
          .totals-table { width: 48%; margin-left: auto; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
          .totals-table td { padding: 6px 10px; }
          .totals-label { color: #64748B; font-weight: 600; }
          .totals-val { text-align: right; font-weight: 700; color: #0F172A; }
          .grand-total-row { border-top: 2px solid #0F172A; border-bottom: 2px solid #0F172A; }
          .grand-total-row td { font-size: 14px; font-weight: 800; color: #0F172A; padding: 10px; }
          .settled-banner { background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; padding: 12px; border-radius: 6px; text-align: center; font-weight: 700; font-size: 13px; margin-bottom: 24px; }
          .unpaid-banner { background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; padding: 12px; border-radius: 6px; text-align: center; font-weight: 700; font-size: 13px; margin-bottom: 24px; }
          .footer-note { font-size: 11px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 16px; }
          .signature-box { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <table class="header-table">
            <tr>
              <td>
                <div class="brand-title">🌿 ${propName}</div>
                <div class="brand-sub">${propAddress}, ${propCity}</div>
                <div class="brand-sub">GSTIN: 27AABCS1429B1Z8 | HSN/SAC Code: 996311</div>
              </td>
              <td style="text-align: right;">
                <span class="tax-badge">TAX INVOICE</span>
                <div style="font-size: 14px; font-weight: 800; color: #0F172A; margin-top: 6px;">${invoiceNo}</div>
                <div style="font-size: 11px; color: #64748B;">Date: ${invoiceDate}</div>
              </td>
            </tr>
          </table>

          <table class="info-table">
            <tr>
              <td style="width: 50%; border-right: 1px solid #E2E8F0;">
                <div class="info-label">Billed To (Guest Details)</div>
                <div class="info-val">${guestName}</div>
                <div style="color: #475569; margin-top: 2px;">📞 ${guestPhone}</div>
                <div style="color: #475569;">✉️ ${guestEmail}</div>
              </td>
              <td style="width: 50%;">
                <div class="info-label">Stay Details</div>
                <div class="info-val">${roomCat} • Room #${roomNum}</div>
                <div style="color: #475569; margin-top: 2px;">📅 ${checkInDate} to ${checkOutDate}</div>
                <div style="color: #475569;">🌙 Duration: ${stayMetrics.nights} Night${stayMetrics.nights > 1 ? 's' : ''}</div>
              </td>
            </tr>
          </table>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th style="text-align: left;">Description</th>
                <th style="width: 60px; text-align: center;">Qty</th>
                <th style="width: 130px; text-align: right;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHtml}
            </tbody>
          </table>

          <table class="totals-table">
            <tr>
              <td class="totals-label">Taxable Value (Base)</td>
              <td class="totals-val">₹${taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="totals-label">CGST (9%)</td>
              <td class="totals-val">₹${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="totals-label">SGST (9%)</td>
              <td class="totals-val">₹${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr class="grand-total-row">
              <td>Total Bill (GST Inclusive)</td>
              <td style="text-align: right;">₹${gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="totals-label" style="color: #059669;">Less: Advance Booking Deposit</td>
              <td class="totals-val" style="color: #059669;">-₹${adv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr style="border-top: 1px solid #CBD5E1;">
              <td style="font-weight: 700; color: #0F172A;">Net Settlement Amount (Total - Advance)</td>
              <td style="text-align: right; font-weight: 700; color: #0F172A;">₹${settlement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            ${
              invoice.status === 'Paid'
                ? `<tr>
                    <td class="totals-label" style="color: #059669;">Settlement Paid at Checkout</td>
                    <td class="totals-val" style="color: #059669;">₹${settlement.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${paymentMethod.toUpperCase()})</td>
                  </tr>
                  <tr style="border-top: 2px solid #0F172A; border-bottom: 2px solid #0F172A;">
                    <td style="font-weight: 800; color: #059669; font-size: 13px;">Remaining Balance Due</td>
                    <td style="text-align: right; font-weight: 800; color: #059669; font-size: 14px;">₹0.00 (PAID)</td>
                  </tr>`
                : `<tr style="border-top: 2px solid #0F172A; border-bottom: 2px solid #0F172A;">
                    <td style="font-weight: 800; color: #DC2626; font-size: 13px;">Net Balance Due (Checkout)</td>
                    <td style="text-align: right; font-weight: 800; color: #DC2626; font-size: 14px;">₹${settlement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>`
            }
          </table>

          ${
            invoice.status === 'Paid'
              ? `<div class="settled-banner">
                  ✓ FULLY SETTLED & PAID • ADVANCE DEPOSIT: ₹${adv.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | CHECKOUT SETTLEMENT: ₹${settlement.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${paymentMethod.toUpperCase()}) • GUEST CHECKED OUT
                </div>`
              : `<div class="unpaid-banner">
                  PENDING SETTLEMENT • NET BALANCE DUE: ₹${settlement.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (TOTAL BILL: ₹${gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })} LESS ADVANCE: ₹${adv.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                </div>`
          }

          <div style="margin-top: 40px; border-top: 1px dashed #CBD5E1; padding-top: 20px;">
            <table style="width: 100%;">
              <tr>
                <td style="font-size: 11px; color: #64748B;">
                  <strong>Terms & Conditions:</strong><br>
                  1. Goods & Services Tax (GST) charged in accordance with Indian Hotel GST Tariff rules.<br>
                  2. All room tariff rates agreed during booking are inclusive of applicable GST.<br>
                  3. This is a computer-generated tax invoice and requires no physical signature.
                </td>
                <td style="text-align: right; font-size: 11px; color: #0F172A; width: 180px;">
                  <br><br>
                  ________________________<br>
                  <strong>Authorized Signatory</strong><br>
                  ${propName}
                </td>
              </tr>
            </table>
          </div>

          <div class="footer-note" style="margin-top: 24px;">
            Thank you for staying with us! Powered by Simply Booking PMS
          </div>
        </div>
      </body>
      </html>
      `;

      // Launch native Print / Save as PDF dialog
      // On Android, iOS, and Web, Print.printAsync opens the native system print interface
      // where "Save as PDF" is built-in as the default printer, bypassing FileProvider permission issues.
      await Print.printAsync({ html: htmlContent });
    } catch (err: any) {
      console.error('PDF error:', err);
      // Don't show alert if the user simply dismissed or cancelled the native print sheet
      if (!err.message?.toLowerCase().includes('cancel') && !err.message?.toLowerCase().includes('dismiss')) {
        Alert.alert('PDF Print / Save Failed', err.message || 'Could not generate PDF');
      }
    } finally {
      setGeneratingPdf(false);
    }
  };

  // 9. Share Bill on WhatsApp
  const handleShareWhatsApp = () => {
    if (!invoice || !selectedReservation) {
      Alert.alert('Invoice Required', 'Please generate or select an invoice first.');
      return;
    }

    const checkInDate = new Date(selectedReservation.checkIn).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const checkOutDate = new Date(selectedReservation.checkOut).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    sendWhatsAppInvoice({
      guestName: selectedReservation.guest?.name || selectedReservation.guestName || 'Valued Guest',
      guestPhone: selectedReservation.guest?.phone || selectedReservation.guestPhone || '',
      propertyName: property?.name || 'Hotel Property',
      invoiceNo: `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
      roomType: selectedReservation.room?.roomCategory?.name,
      roomNumber: selectedReservation.room?.roomNumber,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      nights: stayMetrics.nights,
      grossTotal: stayMetrics.grossAmount,
      advancePaid: stayMetrics.advancePaid,
      settlementPaid: stayMetrics.settlementAmount,
      balanceDue: stayMetrics.balanceDue,
      paymentMethod,
      isPaid: invoice.status === 'Paid',
    });
  };

  return (
    <View style={styles.container}>
      <Header
        title="Folio & Billing"
        subtitle="GST-Inclusive Tax Invoice Engine • Advance Tracking"
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Step 1: Select Active Reservation */}
        <Card style={styles.formCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepText}>1</Text>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.cardTitle}>Select Guest Stay / Reservation</Text>
              <Text style={styles.cardSub}>Generate GST invoice or settle active bill</Text>
            </View>
          </View>

          {/* Search Input */}
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search by Guest Name, Phone or Room #..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Status Filter Chips */}
          <View style={styles.filterChipsRow}>
            {(['ALL', 'ACTIVE', 'CHECKED_OUT'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]}
                onPress={() => setStatusFilter(filter)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, statusFilter === filter && styles.filterChipTextActive]}>
                  {filter === 'ALL' ? 'All Stays' : filter === 'ACTIVE' ? 'Active / In-House' : 'Checked Out'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reservations Picker List */}
          {loadingReservations ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
          ) : (
            <ScrollView style={styles.resPickerScroll} nestedScrollEnabled={true}>
              {filteredReservations.length === 0 ? (
                <Text style={styles.emptyText}>No reservations match your search.</Text>
              ) : (
                filteredReservations.slice(0, 8).map((r) => {
                  const isSelected = selectedReservation?.id === r.id;
                  const gName = r.guest?.name || r.guestName || 'Walk-in Guest';
                  const roomNum = r.room?.roomNumber || '—';
                  const category = r.room?.roomCategory?.name || 'Room';
                  const total = Number(r.totalAmount ?? r.financials?.totalAmount ?? 0) || 0;
                  const adv = Number(r.advancePaid ?? r.financials?.advancePaid ?? 0) || 0;
                  const bal = Math.max(0, total - adv);

                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.resItemCard, isSelected && styles.resItemCardSelected]}
                      onPress={() => handleSelectReservation(r)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.resItemLeft}>
                        <Text style={styles.resItemName}>{gName}</Text>
                        <Text style={styles.resItemDetails}>
                          #{roomNum} ({category}) • {r.status}
                        </Text>
                      </View>
                      <View style={styles.resItemRight}>
                        <Text style={styles.resItemTotal}>₹{total.toLocaleString('en-IN')}</Text>
                        {adv > 0 ? (
                          <Text style={styles.resItemAdv}>
                            Adv: ₹{adv.toLocaleString('en-IN')} • Bal: ₹{bal.toLocaleString('en-IN')}
                          </Text>
                        ) : (
                          <Text style={styles.resItemAdv}>Due: ₹{bal.toLocaleString('en-IN')}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}
        </Card>

        {/* Selected Stay Summary Banner */}
        {selectedReservation && (
          <Card style={styles.summaryBannerCard}>
            <View style={styles.summaryTopRow}>
              <View>
                <Text style={styles.summaryPropName}>
                  {property?.name || 'Simply Booking Hotel'}
                </Text>
                <Text style={styles.summaryGuestTitle}>
                  {selectedReservation.guest?.name || selectedReservation.guestName}
                </Text>
                <Text style={styles.summaryMeta}>
                  Room #{selectedReservation.room?.roomNumber} • {selectedReservation.room?.roomCategory?.name}
                </Text>
              </View>
              <Badge status={selectedReservation.status} dot size="md" />
            </View>

            <View style={styles.summaryDashed} />

            <View style={styles.metricsGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Stay Duration</Text>
                <Text style={styles.metricValue}>
                  {stayMetrics.nights} Night{stayMetrics.nights > 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Agreed Rate</Text>
                <Text style={styles.metricValue}>₹{stayMetrics.dailyRate}/night</Text>
                <Text style={styles.metricSub}>incl. GST</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Advance Deposit</Text>
                <Text style={[styles.metricValue, { color: colors.success }]}>
                  ₹{stayMetrics.advancePaid.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Step 2: Ancillary Add-on Services (Optional) */}
        {selectedReservation && invoice?.status !== 'Paid' && (
          <Card style={styles.formCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepText}>2</Text>
              </View>
              <View style={styles.flex1}>
                <Text style={styles.cardTitle}>Add Services / Ancillary Items</Text>
                <Text style={styles.cardSub}>Food dining, laundry, airport transfer, extra bed</Text>
              </View>
            </View>

            {/* Existing added ancillaries */}
            {ancillaryList.map((item, idx) => (
              <View key={idx} style={styles.ancillaryCard}>
                <View style={styles.ancillaryLeft}>
                  <Text style={styles.ancillaryName}>{item.description}</Text>
                  <Text style={styles.ancillaryCatBadge}>{item.category}</Text>
                </View>
                <View style={styles.ancillaryRight}>
                  <Text style={styles.ancillaryAmount}>₹{Number(item.amount).toLocaleString('en-IN')}</Text>
                  <TouchableOpacity
                    style={styles.deleteCircle}
                    onPress={() => handleRemoveAncillary(idx)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.deleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <View style={styles.addChargeBox}>
              <View style={styles.row}>
                <View style={styles.flex2}>
                  <Text style={styles.inputLabel}>Item Description</Text>
                  <TextInput
                    style={styles.textInput}
                    value={ancillaryDesc}
                    onChangeText={setAncillaryDesc}
                    placeholder="e.g. In-Room Dining / Breakfast"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.colSpacer} />
                <View style={styles.flex1}>
                  <Text style={styles.inputLabel}>Amount (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={ancillaryAmount}
                    onChangeText={setAncillaryAmount}
                    placeholder="450"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Category selector */}
              <View style={styles.categoryChipsRow}>
                {(['FoodAndBeverage', 'Laundry', 'Other'] as InvoiceItemCategory[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, ancillaryCategory === cat && styles.catChipActive]}
                    onPress={() => setAncillaryCategory(cat)}
                  >
                    <Text style={[styles.catChipText, ancillaryCategory === cat && styles.catChipTextActive]}>
                      {cat === 'FoodAndBeverage' ? 'Dining / Food' : cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <PrimaryButton
                title="+ Add Item To Folio"
                variant="secondary"
                size="sm"
                onPress={handleAddAncillary}
                style={styles.addBtn}
              />
            </View>

            <PrimaryButton
              title={loadingInvoice ? 'Updating...' : '🔄 Recalculate & Refresh Folio'}
              variant="primary"
              size="md"
              loading={loadingInvoice}
              onPress={handleRecalculateFolio}
              style={{ marginTop: 12 }}
            />
          </Card>
        )}

        {/* Notifications / Alerts */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Billing Notice</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successTitle}>Status Notice</Text>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {/* Itemized GST Tax Invoice Card */}
        {invoice && (
          <Card style={styles.receiptCard}>
            <View style={styles.receiptTop}>
              <View>
                <Text style={styles.receiptBrand}>
                  {property?.name?.toUpperCase() || 'SIMPLY BOOKING PMS'} • {property?.city?.toUpperCase() || 'PUNE'}
                </Text>
                <Text style={styles.receiptHeading}>GST Tax Invoice & Folio</Text>
                <Text style={styles.receiptId}>
                  GSTIN: 27AABCS1429B1Z8 • Inv #{invoice.id.slice(0, 8).toUpperCase()}
                </Text>
              </View>
              <Badge status={invoice.status} dot size="md" />
            </View>

            <View style={styles.dashedLine} />

            {/* Charges Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.thText, styles.flex3]}>DESCRIPTION</Text>
              <Text style={[styles.thText, styles.flex1, styles.textCenter]}>SAC</Text>
              <Text style={[styles.thText, styles.flex1, styles.textRight]}>AMOUNT (₹)</Text>
            </View>

            {/* Charges Rows */}
            {(invoice.items || []).map((item, idx) => (
              <View key={item?.id || idx} style={styles.tableRow}>
                <View style={styles.flex3}>
                  <Text style={styles.tdDesc}>{item?.description || '—'}</Text>
                </View>
                <Text style={[styles.tdCategory, styles.flex1, styles.textCenter]}>
                  {item?.category === 'Room' ? '996311' : item?.category === 'FoodAndBeverage' ? '996331' : '9996'}
                </Text>
                <Text style={[styles.tdAmount, styles.flex1, styles.textRight]}>
                  ₹{Number(item?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            ))}

            <View style={styles.solidLine} />

            {/* GST Tax Breakdown (Inclusive) */}
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Taxable Base Amount (Excl. Tax)</Text>
              <Text style={styles.calcValue}>
                ₹{Number(invoice.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>CGST (9%)</Text>
              <Text style={styles.calcValue}>
                ₹{(Number(invoice.taxAmount || 0) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>SGST (9%)</Text>
              <Text style={styles.calcValue}>
                ₹{(Number(invoice.taxAmount || 0) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.totalChargesRow}>
              <Text style={styles.totalChargesLabel}>Total Bill Amount (GST Inclusive)</Text>
              <Text style={styles.totalChargesValue}>
                ₹{stayMetrics.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            {/* Advance Deposit Deduction */}
            <View style={styles.advanceRow}>
              <Text style={styles.advanceLabel}>Less: Advance Deposit Paid (Booking)</Text>
              <Text style={styles.advanceValue}>
                -₹{stayMetrics.advancePaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            {/* Final Settlement Amount / Balance Due */}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>
                {invoice.status === 'Paid' ? 'Settlement Paid at Checkout' : 'Net Settlement Due (Total - Advance)'}
              </Text>
              <Text
                style={[
                  styles.grandTotalValue,
                  invoice.status === 'Paid' ? { color: colors.success } : { color: colors.primary },
                ]}
              >
                ₹{stayMetrics.settlementAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            {invoice.status === 'Paid' && (
              <View style={[styles.calcRow, { marginTop: 6 }]}>
                <Text style={[styles.calcLabel, { color: colors.success, fontWeight: '700' }]}>
                  Remaining Outstanding Balance
                </Text>
                <Text style={[styles.calcValue, { color: colors.success, fontWeight: '700' }]}>
                  ₹0.00 (Fully Settled)
                </Text>
              </View>
            )}

            {/* Settlement Action (if unpaid) */}
            {invoice.status !== 'Paid' ? (
              <View style={styles.settleBox}>
                <Text style={styles.settleTitle}>Select Settlement Payment Mode:</Text>
                <View style={styles.paymentMethodRow}>
                  {(['UPI', 'Cash', 'Card'] as const).map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[styles.payMethodBtn, paymentMethod === method && styles.payMethodBtnActive]}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Text style={[styles.payMethodText, paymentMethod === method && styles.payMethodTextActive]}>
                        {method === 'UPI' ? '📱 UPI / QR' : method === 'Cash' ? '💵 Cash' : '💳 Card'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <PrimaryButton
                  title={
                    submittingPayment
                      ? 'Settling Bill...'
                      : `✓ Settle Bill (₹${stayMetrics.settlementAmount.toLocaleString('en-IN')}) & Complete Checkout`
                  }
                  variant="success"
                  size="lg"
                  loading={submittingPayment}
                  onPress={handlePayInvoice}
                  style={styles.payBtn}
                />
              </View>
            ) : (
              <View style={styles.settledBadge}>
                <Text style={styles.settledText}>
                  ✓ Folio fully settled! Settlement of ₹{stayMetrics.settlementAmount.toLocaleString('en-IN')} received via {paymentMethod}. Guest marked as CheckedOut.
                </Text>
              </View>
            )}

            {/* PDF Generation & Share Actions */}
            <View style={styles.pdfActionRow}>
              <TouchableOpacity
                style={styles.pdfDownloadBtn}
                onPress={handleGeneratePdf}
                disabled={generatingPdf}
                activeOpacity={0.8}
              >
                {generatingPdf ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.pdfBtnIcon}>🖨️</Text>
                    <Text style={styles.pdfBtnText}>Print / Save as PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.whatsappShareBtn}
                onPress={handleShareWhatsApp}
                activeOpacity={0.8}
              >
                <Text style={styles.pdfBtnIcon}>💬</Text>
                <Text style={styles.whatsappShareBtnText}>Share Bill on WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </Card>
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
    paddingBottom: 50,
  },
  formCard: {
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepText: {
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: '800',
  },
  cardTitle: {
    ...typography.h3,
  },
  cardSub: {
    ...typography.bodySmall,
  },
  searchInput: {
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    fontSize: 13,
    backgroundColor: colors.surfaceSubtle,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textWhite,
  },
  resPickerScroll: {
    maxHeight: 200,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
    marginVertical: 16,
  },
  resItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  resItemCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: colors.primary,
  },
  resItemLeft: {
    flex: 1,
  },
  resItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resItemDetails: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  resItemRight: {
    alignItems: 'flex-end',
  },
  resItemTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  resItemAdv: {
    fontSize: 10,
    color: colors.success,
    fontWeight: '600',
    marginTop: 1,
  },
  summaryBannerCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryPropName: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryGuestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  summaryMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  summaryDashed: {
    height: 1,
    backgroundColor: '#DCFCE7',
    marginVertical: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  metricSub: {
    fontSize: 10,
    color: colors.textMuted,
  },
  ancillaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    marginBottom: 6,
  },
  ancillaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  ancillaryName: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  ancillaryCatBadge: {
    fontSize: 10,
    color: colors.textMuted,
    backgroundColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ancillaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ancillaryAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  deleteCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  addChargeBox: {
    backgroundColor: colors.surfaceSubtle,
    padding: 12,
    borderRadius: borderRadius.md,
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  flex3: { flex: 3 },
  colSpacer: { width: 10 },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    fontSize: 13,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  catChipTextActive: {
    color: colors.textWhite,
  },
  addBtn: {
    marginTop: 4,
  },
  errorBanner: {
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
  successBanner: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 12,
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.successDark,
  },
  successText: {
    fontSize: 11,
    color: colors.successDark,
    marginTop: 2,
  },
  receiptCard: {
    backgroundColor: colors.surface,
    padding: 18,
    marginBottom: 20,
  },
  receiptTop: {
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
  receiptHeading: {
    ...typography.h2,
    fontSize: 16,
    color: colors.primary,
    marginTop: 2,
  },
  receiptId: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  dashedLine: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  thText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  tdDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tdCategory: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  tdAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  textCenter: { textAlign: 'center' },
  textRight: { textAlign: 'right' },
  solidLine: {
    height: 1.5,
    backgroundColor: colors.borderDark,
    marginTop: 10,
    marginBottom: 12,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  calcLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  calcValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  totalChargesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginVertical: 6,
  },
  totalChargesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalChargesValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  advanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  advanceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  advanceValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.success,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderColor: colors.primary,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  settleBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settleTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  payMethodBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payMethodBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  payMethodText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  payMethodTextActive: {
    color: colors.textWhite,
  },
  payBtn: {
    marginTop: 4,
  },
  settledBadge: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  settledText: {
    color: colors.successDark,
    fontWeight: '700',
    fontSize: 13,
  },
  pdfActionRow: {
    marginTop: 16,
    gap: 10,
  },
  pdfDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    ...shadows.card,
  },
  pdfBtnIcon: {
    fontSize: 16,
  },
  pdfBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  whatsappShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    ...shadows.card,
  },
  whatsappShareBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
