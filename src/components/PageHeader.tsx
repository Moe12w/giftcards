// src/components/PageHeader.tsx
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, fontSizes, spacing } from '../theme';
import { BackButton } from './BackButton';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  size?: 'display' | 'compact';
  style?: StyleProp<ViewStyle>;
}

export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
  size = 'display',
  style,
}: PageHeaderProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.row}>
        {onBack ? <BackButton onPress={onBack} /> : null}
        <View style={styles.text}>
          <Text style={[styles.title, size === 'compact' && styles.titleCompact]}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1, gap: 2 },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.display,
    color: colors.text,
    letterSpacing: -0.4,
  },
  titleCompact: { fontSize: fontSizes.xxl },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  right: { marginStart: spacing.sm },
});
