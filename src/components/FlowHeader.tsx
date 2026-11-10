// src/components/FlowHeader.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSizes, spacing } from '../theme';
import { BackButton } from './BackButton';
import { ProgressDots } from './ProgressDots';

interface FlowHeaderProps {
  title: string;
  subtitle?: string;
  step?: number;
  total?: number;
  onBack: () => void;
}

/** Header for multi-step journeys: back button, title, subtitle and progress. */
export function FlowHeader({ title, subtitle, step, total, onBack }: FlowHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <BackButton onPress={onBack} />
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {typeof step === 'number' && typeof total === 'number' ? (
        <ProgressDots count={total} active={step} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1, gap: 2 },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
});
