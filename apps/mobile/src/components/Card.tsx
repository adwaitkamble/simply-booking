import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, shadows, borderRadius } from '../theme';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'outlined' | 'elevated' | 'subtle';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
}) => {
  return (
    <View
      style={[
        styles.card,
        variant === 'elevated' && styles.cardElevated,
        variant === 'outlined' && styles.cardOutlined,
        variant === 'subtle' && styles.cardSubtle,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardElevated: {
    ...shadows.cardHover,
  },
  cardOutlined: {
    shadowOpacity: 0,
    elevation: 0,
    borderColor: colors.borderDark,
  },
  cardSubtle: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
});
