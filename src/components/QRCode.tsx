// src/components/QRCode.tsx
// Redemption codes are always shown on a white background in light and dark
// mode so scanners can read them reliably. QR codes never flip in RTL.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import QRCodeSvg from 'react-native-qrcode-svg';
import { colors, radii, spacing, themedStyles } from '../theme';

interface QRCodeProps {
  value: string;
  size?: number;
}

export function QRCode({ value, size = 220 }: QRCodeProps) {
  return (
    <View style={styles.wrapper}>
      <QRCodeSvg value={value} size={size} backgroundColor={colors.qrBackground} color="#000000" />
    </View>
  );
}

const styles = themedStyles(() => ({
  wrapper: {
    backgroundColor: colors.qrBackground,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
