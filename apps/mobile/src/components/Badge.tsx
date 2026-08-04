import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, borderRadius } from '../theme';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'purple'
  | 'neutral'
  | 'dark';

export interface BadgeProps {
  label?: string;
  status?: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  status,
  variant,
  size = 'md',
  style,
  textStyle,
  dot = false,
}) => {
  const text = label || status || '';

  // Auto-detect variant from status if variant not explicitly provided
  const resolvedVariant: BadgeVariant =
    variant ||
    (status === 'Clean' || status === 'Confirmed' || status === 'Paid' || status === 'SUCCESS'
      ? 'success'
      : status === 'Dirty' || status === 'Unpaid' || status === 'WARNING' || status === 'CONFLICT_409'
      ? 'warning'
      : status === 'Maintenance' || status === 'Cancelled' || status === 'ERROR'
      ? 'error'
      : status === 'Inspecting' || status === 'CheckedIn' || status === 'INBOUND'
      ? 'info'
      : status === 'Expedia' || status === 'Booking.com' || status === 'Airbnb' || status === 'Agoda' || status === 'OUTBOUND'
      ? 'purple'
      : 'neutral');

  return (
    <View
      style={[
        styles.badge,
        styles[resolvedVariant],
        size === 'sm' ? styles.size_sm : styles.size_md,
        style,
      ]}
    >
      {dot ? (
        <View
          style={[
            styles.dot,
            styles[`dot_${resolvedVariant}`],
          ]}
        />
      ) : null}
      <Text
        style={[
          styles.text,
          styles[`text_${resolvedVariant}`],
          size === 'sm' ? styles.textSize_sm : styles.textSize_md,
          textStyle,
        ]}
      >
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  size_sm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  size_md: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  // Variant styles
  success: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
  },
  warning: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warningBorder,
  },
  error: {
    backgroundColor: colors.errorLight,
    borderColor: colors.errorBorder,
  },
  info: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accentMuted,
  },
  purple: {
    backgroundColor: colors.purpleLight,
    borderColor: colors.purpleBorder,
  },
  neutral: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
  },
  dark: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  // Dot styles
  dot_success: { backgroundColor: colors.success },
  dot_warning: { backgroundColor: colors.warning },
  dot_error: { backgroundColor: colors.error },
  dot_info: { backgroundColor: colors.accent },
  dot_purple: { backgroundColor: colors.purple },
  dot_neutral: { backgroundColor: colors.textSecondary },
  dot_dark: { backgroundColor: colors.textWhite },
  // Text styles
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  text_success: { color: colors.successDark },
  text_warning: { color: colors.warningDark },
  text_error: { color: colors.errorDark },
  text_info: { color: colors.accentDark },
  text_purple: { color: colors.purpleDark },
  text_neutral: { color: colors.textSecondary },
  text_dark: { color: colors.textWhite },
  textSize_sm: {
    fontSize: 10,
  },
  textSize_md: {
    fontSize: 11,
  },
});
