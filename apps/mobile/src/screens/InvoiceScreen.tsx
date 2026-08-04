import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { ApiClient } from '../api/client';
import type {
  InvoiceDTO,
  InvoiceItemCategory,
  AncillaryItemInput,
} from '@hotel-pms/types';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { StyledInput } from '../components/StyledInput';
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
  const [reservationId, setReservationId] = useState(initialReservationId);
  const [invoice, setInvoice] = useState<InvoiceDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Ancillary charge inputs
  const [ancillaryDesc, setAncillaryDesc] = useState('Room Service - Breakfast');
  const [ancillaryAmount, setAncillaryAmount] = useState('50');
  const [ancillaryCategory, setAncillaryCategory] = useState<InvoiceItemCategory>('FoodAndBeverage');
  const [ancillaryList, setAncillaryList] = useState<AncillaryItemInput[]>([
    { description: 'Room Service - Breakfast', amount: 50, quantity: 1, category: 'FoodAndBeverage' },
    { description: 'Laundry Service', amount: 20, quantity: 1, category: 'Laundry' },
  ]);

  // Load existing reservations on mount to pre-populate if none provided
  useEffect(() => {
    if (!reservationId) {
      ApiClient.fetchReservations()
        .then((resList) => {
          if (resList.length > 0) {
            setReservationId(resList[0].id);
          }
        })
        .catch(() => {});
    }
  }, []);

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

  const handleGenerateInvoice = async () => {
    if (!reservationId.trim()) {
      setError('Reservation UUID is required to generate or fetch invoice');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      const generated = await ApiClient.generateInvoice({
        reservationId: reservationId.trim(),
        ancillaryItems: ancillaryList,
      });

      setInvoice(generated);
      setSuccessMessage('Folio generated with dynamic 18% tax and ancillary charges.');
    } catch (err: any) {
      setError(err.message || 'Failed to generate invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePayInvoice = async () => {
    if (!invoice) return;

    try {
      setSubmittingPayment(true);
      setError(null);

      const paidInvoice = await ApiClient.payInvoice(invoice.id);
      setInvoice(paidInvoice);
      setSuccessMessage('Payment settled! Reservation marked as CheckedOut.');
    } catch (err: any) {
      setError(err.message || 'Payment processing failed');
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Dynamic Folio & Invoicing"
        subtitle="ACID Billing Engine • Itemized Tax Breakdown"
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Reservation Specification Card */}
        <Card style={styles.formCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepText}>1</Text>
            </View>
            <View>
              <Text style={styles.cardTitle}>Target Reservation</Text>
              <Text style={styles.cardSub}>Generate itemized folio for active stay</Text>
            </View>
          </View>

          <StyledInput
            label="Reservation UUID (PostgreSQL ID)"
            value={reservationId}
            onChangeText={setReservationId}
            placeholder="e.g. 67781a12-8806-4aff-95bc-3845bb744d30"
          />

          <View style={styles.divider} />

          {/* Pending Ancillary Add-Ons */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Pending Ancillary Charges ({ancillaryList.length})
            </Text>
          </View>

          {ancillaryList.map((item, idx) => (
            <View key={idx} style={styles.ancillaryCard}>
              <View style={styles.ancillaryLeft}>
                <Badge
                  label={item.category === 'FoodAndBeverage' ? 'F&B' : item.category}
                  variant="info"
                  size="sm"
                />
                <Text style={styles.ancillaryName}>{item.description}</Text>
              </View>
              <View style={styles.ancillaryRight}>
                <Text style={styles.ancillaryAmount}>₹{item.amount.toLocaleString('en-IN')}</Text>
                <TouchableOpacity
                  style={styles.deleteCircle}
                  onPress={() => handleRemoveAncillary(idx)}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Add New Ancillary Form */}
          <View style={styles.addChargeBox}>
            <Text style={styles.addChargeTitle}>Add Ancillary Service / Charge</Text>
            <View style={styles.row}>
              <View style={styles.flex2}>
                <StyledInput
                  label="Description"
                  value={ancillaryDesc}
                  onChangeText={setAncillaryDesc}
                  placeholder="e.g. Pune Airport Transfer / Room Dining"
                />
              </View>
              <View style={styles.colSpacer} />
              <View style={styles.flex1}>
                <StyledInput
                  label="Amount (₹)"
                  value={ancillaryAmount}
                  onChangeText={setAncillaryAmount}
                  placeholder="850.00"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Category Selector Chips */}
            <View style={styles.categoryChipsRow}>
              {(['FoodAndBeverage', 'Laundry', 'Other'] as InvoiceItemCategory[]).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    ancillaryCategory === cat && styles.catChipActive,
                  ]}
                  onPress={() => setAncillaryCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      ancillaryCategory === cat && styles.catChipTextActive,
                    ]}
                  >
                    {cat === 'FoodAndBeverage' ? 'Food & Dining' : cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <PrimaryButton
              title="+ Add Ancillary Item"
              variant="secondary"
              size="sm"
              onPress={handleAddAncillary}
              style={styles.addBtn}
            />
          </View>

          <PrimaryButton
            title={loading ? 'Generating Folio...' : 'Generate & Calculate Invoice (GST 18%)'}
            variant="primary"
            size="md"
            loading={loading}
            onPress={handleGenerateInvoice}
            style={styles.generateBtn}
          />
        </Card>

        {/* Error Notification */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Billing Error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Success Notice */}
        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successTitle}>Status Notice</Text>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {/* High-Fidelity Itemized Digital Receipt Card */}
        {invoice ? (
          <Card style={styles.receiptCard}>
            <View style={styles.receiptTop}>
              <View>
                <Text style={styles.receiptBrand}>THE ROYAL MARATHA RESORT • PUNE</Text>
                <Text style={styles.receiptHeading}>Tax Invoice & Folio Receipt</Text>
                <Text style={styles.receiptId}>GSTIN: 27AAACH1234F1Z5 • Inv #{invoice.id.slice(0, 8)}</Text>
              </View>
              <Badge status={invoice.status} dot size="md" />
            </View>

            <View style={styles.dashedLine} />

            {/* Charges Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.thText, styles.flex3]}>DESCRIPTION</Text>
              <Text style={[styles.thText, styles.flex1, styles.textCenter]}>CATEGORY</Text>
              <Text style={[styles.thText, styles.flex1, styles.textRight]}>AMOUNT (₹)</Text>
            </View>

            {/* Charges Rows */}
            {invoice.items?.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.tdDesc, styles.flex3]}>{item.description}</Text>
                <Text style={[styles.tdCategory, styles.flex1, styles.textCenter]}>
                  {item.category === 'FoodAndBeverage' ? 'Dining' : item.category}
                </Text>
                <Text style={[styles.tdAmount, styles.flex1, styles.textRight]}>
                  ₹{item.amount.toLocaleString('en-IN')}
                </Text>
              </View>
            ))}

            <View style={styles.solidLine} />

            {/* Financial Calculations */}
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Subtotal Charges</Text>
              <Text style={styles.calcValue}>₹{invoice.subtotal.toLocaleString('en-IN')}</Text>
            </View>

            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>GST (18%: 9% CGST + 9% SGST)</Text>
              <Text style={styles.calcValue}>₹{invoice.taxAmount.toLocaleString('en-IN')}</Text>
            </View>

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Grand Total (Due)</Text>
              <Text style={styles.grandTotalValue}>₹{invoice.grandTotal.toLocaleString('en-IN')}</Text>
            </View>

            {/* Payment Settlement Action */}
            {invoice.status !== 'Paid' ? (
              <PrimaryButton
                title={submittingPayment ? 'Processing Settlement...' : '✓ Pay & Complete Checkout'}
                variant="success"
                size="lg"
                loading={submittingPayment}
                onPress={handlePayInvoice}
                style={styles.payBtn}
              />
            ) : (
              <View style={styles.settledBadge}>
                <Text style={styles.settledText}>
                  ✓ Folio fully settled. Guest marked as CheckedOut.
                </Text>
              </View>
            )}
          </Card>
        ) : null}
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
  formCard: {
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
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
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  sectionHeaderRow: {
    marginBottom: 8,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
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
    fontWeight: '500',
    flex: 1,
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
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  addChargeBox: {
    backgroundColor: colors.surfaceSubtle,
    padding: 12,
    borderRadius: borderRadius.md,
    marginTop: 8,
  },
  addChargeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  flex3: { flex: 3 },
  colSpacer: { width: 10 },
  categoryChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
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
  generateBtn: {
    marginTop: 14,
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
  // Receipt Card
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
    paddingVertical: 5,
  },
  tdDesc: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  tdCategory: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  tdAmount: {
    fontSize: 13,
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
    marginBottom: 6,
  },
  calcLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  calcValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
  },
  payBtn: {
    marginTop: 16,
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
});
