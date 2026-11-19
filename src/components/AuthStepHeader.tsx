// src/components/AuthStepHeader.tsx
import React from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BackButton } from './BackButton';
import { Eyebrow } from './Eyebrow';
import { ProgressDots } from './ProgressDots';
import { SplashText } from './SplashText';
import { colors, fonts, fontSizes, spacing, themedStyles } from '../theme';

interface AuthStepHeaderProps {
  /** Zero-based index of the current screen. */
  step: number;
  total: number;
  title: string;
  subtitle: string;
  tone?: 'gold' | 'teal' | 'lavender' | 'pink' | 'sky';
}

/** Shared header for the sign-up steps: back, progress, sticker, highlighted title. */
export function AuthStepHeader({
  step,
  total,
  title,
  subtitle,
  tone = 'teal',
}: AuthStepHeaderProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
        <ProgressDots count={total} active={step} />
        <View style={styles.spacer} />
      </View>
      <Eyebrow label={t('authExtra.signupStep', { current: step + 1, total })} tone={tone} />
      <SplashText fontSize={fontSizes.xxl} tone="lavender" wrapStyle={styles.title}>
        {title}
      </SplashText>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { gap: spacing.xs, alignItems: 'flex-start' },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  spacer: { width: 44 },
  title: { marginTop: spacing.xs },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 22,
  },
}));
