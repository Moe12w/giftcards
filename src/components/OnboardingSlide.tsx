// src/components/OnboardingSlide.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing } from '../theme';
import { Button } from './Button';
import { ProgressDots } from './ProgressDots';
import { Screen } from './Screen';
import type { AccentTone } from '../lib/types';
import { Glyph } from './Glyph';

interface OnboardingSlideProps {
  /** Semantic glyph key from `src/lib/glyphs.ts`. */
  icon: string;
  tone: AccentTone;
  title: string;
  body: string;
  step: number;
  total: number;
  nextLabel: string;
  skipLabel: string;
  onNext: () => void;
  onSkip: () => void;
}

const backgrounds: Record<AccentTone, string> = {
  teal: colors.tealTint,
  pink: colors.pinkTint,
  lavender: colors.lavenderTint,
  gold: colors.creamSoft,
  sky: colors.skySoft,
};

const blobs: Record<AccentTone, string> = {
  teal: colors.teal,
  pink: colors.pink,
  lavender: colors.lavender,
  gold: colors.gold,
  sky: colors.sky,
};

export function OnboardingSlide({
  icon,
  tone,
  title,
  body,
  step,
  total,
  nextLabel,
  skipLabel,
  onNext,
  onSkip,
}: OnboardingSlideProps) {
  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.topRow}>
        <Text style={styles.step}>
          {step + 1} / {total}
        </Text>
        <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.skip}>{skipLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.illustration}>
        <View style={[styles.blob, { backgroundColor: blobs[tone] }]} />
        <View style={[styles.circle, { backgroundColor: backgrounds[tone] }]}>
          <Glyph name={icon} size={54} />
        </View>
        <Glyph name="star" size={20} color={colors.pink} style={[styles.sparkle, styles.sparkleA]} />
        <Glyph name="star" size={14} color={colors.gold} style={[styles.sparkle, styles.sparkleB]} />
        <Glyph name="star" size={11} color={colors.teal} style={[styles.sparkle, styles.sparkleC]} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>

      <View style={styles.footer}>
        <ProgressDots count={total} active={step} />
        <Button label={nextLabel} onPress={onNext} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  step: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  skip: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  illustration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blob: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    opacity: 0.35,
    transform: [{ translateX: 14 }, { translateY: 10 }],
  },
  circle: {
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    color: colors.ink,
    fontSize: 22,
  },
  sparkleA: { top: '18%', left: '16%' },
  sparkleB: { top: '26%', right: '14%', fontSize: 14 },
  sparkleC: { bottom: '20%', left: '24%', fontSize: 12 },
  copy: { gap: spacing.sm },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.display,
    color: colors.text,
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 22,
  },
  footer: { gap: spacing.lg },
});
