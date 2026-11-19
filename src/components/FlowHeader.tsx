// src/components/FlowHeader.tsx
import React from 'react';
import { Text, View } from 'react-native';
import { colors, fonts, fontSizes, spacing, themedStyles } from '../theme';
import { BackButton } from './BackButton';
import { ProgressDots } from './ProgressDots';
import { SplashText } from './SplashText';

interface FlowHeaderProps {
  title: string;
  subtitle?: string;
  step?: number;
  total?: number;
  /** Paints the site's lavender highlighter swipe behind the title. */
  splash?: boolean;
  onBack: () => void;
}

/** Header for multi-step journeys: back button, title, subtitle and progress. */
export function FlowHeader({ title, subtitle, step, total, splash = false, onBack }: FlowHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <BackButton onPress={onBack} />
        <View style={styles.text}>
          {splash ? (
            <SplashText fontSize={fontSizes.xxl} wrapStyle={styles.splashWrap}>
              {title}
            </SplashText>
          ) : (
            <Text style={styles.title}>{title}</Text>
          )}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {typeof step === 'number' && typeof total === 'number' ? (
        <ProgressDots count={total} active={step} />
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => ({
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
  splashWrap: { alignSelf: 'flex-start' },
}));
