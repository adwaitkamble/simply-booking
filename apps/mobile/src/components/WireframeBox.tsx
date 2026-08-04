import React, { ReactNode } from 'react';
import { ViewStyle } from 'react-native';
import { Card } from './Card';

interface WireframeBoxProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
}

/**
 * High-Fidelity drop-in replacement for legacy WireframeBox
 */
export const WireframeBox: React.FC<WireframeBoxProps> = ({ children, style }) => {
  return <Card style={style}>{children}</Card>;
};
