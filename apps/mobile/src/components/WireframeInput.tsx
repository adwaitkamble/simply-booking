import React from 'react';
import { TextInputProps, ViewStyle, TextStyle } from 'react-native';
import { StyledInput } from './StyledInput';

interface WireframeInputProps extends TextInputProps {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
}

/**
 * High-Fidelity drop-in replacement for legacy WireframeInput
 */
export const WireframeInput: React.FC<WireframeInputProps> = ({
  label,
  error,
  containerStyle,
  labelStyle,
  style,
  ...rest
}) => {
  return (
    <StyledInput
      label={label}
      error={error}
      containerStyle={containerStyle}
      labelStyle={labelStyle}
      style={style}
      {...rest}
    />
  );
};
