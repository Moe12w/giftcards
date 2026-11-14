// src/components/GiftCardVisual.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AccentTone } from '../lib/types';
import { colors, fonts, fontSizes, spacing, themedStyles } from '../theme';
import { Badge, type BadgeTone } from './Badge';
import { Card, type CardTone } from './Card';
import { IconTile, type IconTileTone } from './IconTile';
import { Money } from './Money';

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
  compact?: boolean;
}

const cardTones: Record<AccentTone, CardTone> = {
  teal: 'teal',
  pink: 'pink',
  lavender: 'lavender',
  gold: 'gold',
  sky: 'sky',
};

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
  compact = false,
}: GiftCardVisualProps) {
  const { t } = useTranslation();
  const isSession = typeof sessionsTotal === 'number' && sessionsTotal > 0;

  const body = (
    <Card tone={cardTones[tone] ?? cardTones.lavender} style={compact ? styles.compact : undefined}>
      <View style={styles.topRow}>
        <IconTile
          icon={icon}
          imageUrl={logoUrl}
          size={compact ? 42 : 48}
          tone={tone as IconTileTone}
        />
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {message ? (
            <Text style={styles.message} numberOfLines={1}>
              {message}
            </Text>
          ) : null}
        </View>
        {badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
      </View>

      {isSession ? (
        <View style={styles.balanceWrap}>
          <Text style={styles.balanceLabel}>{t('sessions.remaining')}</Text>
          <Text style={styles.sessionCount}>
            {t('sessions.leftOf', {
              remaining: sessionsRemaining ?? sessionsTotal ?? 0,
              total: sessionsTotal ?? 0,
            })}
          </Text>
        </View>
      ) : typeof amountMinor === 'number' ? (
        <View style={styles.balanceWrap}>
          <Text style={styles.balanceLabel}>{t('gifts.balance')}</Text>
          <Money minor={amountMinor} style={styles.balance} />
        </View>
      ) : null}

      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </Card>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleWrap: { flex: 1, gap: 1 },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  balanceWrap: { marginTop: spacing.sm, gap: 1 },
  balanceLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  balance: { fontSize: fontSizes.xxl, color: colors.text },
  sessionCount: { fontFamily: fonts.extrabold, fontSize: fontSizes.xl, color: colors.text },
  meta: {
    marginTop: spacing.sm,
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  compact: { padding: spacing.sm + 2 },
  pressed: { opacity: 0.9 },
}));
