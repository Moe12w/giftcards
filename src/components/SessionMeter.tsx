// src/components/SessionMeter.tsx
// Shows how many sessions are left on an experience gift card.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';

interface SessionMeterProps {
  /** Sessions still available. */
  remaining: number;
  /** Sessions included on the card. */
  total: number;
  tone?: 'teal' | 'pink' | 'lavender' | 'gold' | 'sky';
  compact?: boolean;
}

const TONE_FILL: Record<string, string> = {
  get teal() { return colors.teal; },
  get pink() { return colors.pink; },
  get lavender() { return colors.lavender; },
  get gold() { return colors.gold; },
  get sky() { return colors.sky; },
};

export function SessionMeter({
  remaining,
  total,
  tone = 'teal',
  compact = false,
}: SessionMeterProps) {
  const { t } = useTranslation();
  const safeTotal = Math.max(1, total);
  const fill = TONE_FILL[tone] ?? colors.teal;
  const used = Math.max(0, safeTotal - remaining);
  const dots = Math.min(safeTotal, 12);

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{t('sessions.remaining')}</Text>
        <Text style={styles.count}>
          {t('sessions.leftOf', { remaining, total: safeTotal })}
        </Text>
      </View>
      <View style={styles.track}>
        {Array.from({ length: dots }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { borderColor: colors.ink, backgroundColor: index < used ? 'transparent' : fill },
            ]}
          />
        ))}
      </View>
      {compact ? null : (
        <Text style={styles.hint}>{t('sessions.hint')}</Text>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrapper: { gap: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  count: { fontFamily: fonts.extrabold, fontSize: fontSizes.md, color: colors.text },
  track: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  hint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  pill: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
}));
