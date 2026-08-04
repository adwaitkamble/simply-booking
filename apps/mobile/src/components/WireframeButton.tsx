import React from 'react';
import { ViewStyle, TextStyle } from 'react-native';
import { PrimaryButton, ButtonVariant } from './PrimaryButton';

interface WireframeButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  variant?: 'primary' | 'secondary' | 'danger' | 'dark' | 'success';
}

/**
 * High-Fidelity drop-in replacement for legacy WireframeButton
 */
export const WireframeButton: React.FC<WireframeButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
  variant = 'primary',
}) => {
  return (
    <PrimaryButton
      title={title}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      variant={variant as ButtonVariant}
      style={style}
      textStyle={textStyle}
    />
  );
};
