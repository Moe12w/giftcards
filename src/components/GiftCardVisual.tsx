// src/components/GiftCardVisual.tsx
import React from 'react';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AccentTone } from '../lib/types';
import { colors, fonts, fontSizes, radii, themedStyles } from '../theme';
import { Badge, type BadgeTone } from './Badge';
import { Money } from './Money';
import { PosterCard } from './PosterCard';

interface GiftCardVisualProps {
  title: string;
  /** Semantic glyph key — shown when the card has no vendor logo. */
  icon?: string;
  /** Vendor logo image URL — renders the logo instead of the glyph when present. */
  logoUrl?: string | null;
  tone?: AccentTone;
  amountMinor?: number;
  /** Experience cards show the sessions left instead of a money balance. */
  sessionsTotal?: number;
  sessionsRemaining?: number;
  meta?: string;
  message?: string;
  badge?: { label: string; tone: BadgeTone };
  onPress?: () => void;
  onPressIn?: () => void;
  compact?: boolean;
}

/**
 * A customer's gift card, drawn with the same art-panel/body card as the
 * marketplace offers on the website. `compact` is used on checkout and preview
 * screens where the card sits beside a form.
 */
export function GiftCardVisual({
  title,
  icon = 'gift',
  logoUrl,
  tone = 'lavender',
  amountMinor,
  sessionsTotal,
  sessionsRemaining,
  meta,
  message,
  badge,
  onPress,
  onPressIn,
  compact = false,
}: GiftCardVisualProps) {
  const { t } = useTranslation();
  const isSession = typeof sessionsTotal === 'number' && sessionsTotal > 0;

  const card = (
    <PosterCard
      tone={tone}
      icon={icon}
      iconSize={compact ? 28 : 34}
      iconNode={logoUrl ? (
        <View style={compact ? styles.logoCompact : styles.logo}>
          <Image source={logoUrl} style={styles.logoImage} contentFit="contain" cachePolicy="memory-disk" />
        </View>
      ) : undefined}
      title={title}
      subtitle={message}
      titleNumberOfLines={1}
      artHeight={compact ? 92 : 122}
      tag={badge ? <Badge label={badge.label} tone={badge.tone} /> : undefined}
      metaLeft={
        isSession ? (
          <View style={styles.balanceWrap}>
            <Text style={styles.balanceLabel}>{t('sessions.remaining')}</Text>
            <Text style={styles.sessionCount}>
              {t('sessions.leftOf', {
                // Strings, so the digits stay Latin on every engine.
                remaining: String(sessionsRemaining ?? sessionsTotal ?? 0),
                total: String(sessionsTotal ?? 0),
              })}
            </Text>
          </View>
        ) : typeof amountMinor === 'number' ? (
          <View style={styles.balanceWrap}>
            <Text style={styles.balanceLabel}>{t('gifts.balance')}</Text>
            <Money minor={amountMinor} style={styles.balance} />
          </View>
        ) : undefined
      }
      metaRight={meta ? <Text style={styles.meta}>{meta}</Text> : undefined}
    />
  );

  if (!onPress) return card;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {card}
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  logo: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCompact: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: { width: 34, height: 34 },
  balanceWrap: { gap: 1 },
  balanceLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  balance: { fontSize: fontSizes.xxl, color: colors.text },
  sessionCount: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xl,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'right',
  },
  pressed: { opacity: 0.9 },
}));
