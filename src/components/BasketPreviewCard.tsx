// src/components/BasketPreviewCard.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react-native';

import { basketProgress, basketTotal } from '../lib/baskets';
import type { BasketStatus, GiftBasket } from '../lib/types';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Badge, type BadgeTone } from './Badge';
import { Card } from './Card';
import { GiftBox3D } from './GiftBox3D';
import { Money } from './Money';
import { ParticipantStack } from './ParticipantStack';

interface BasketPreviewCardProps {
  basket: GiftBasket;
  onPress: () => void;
  compact?: boolean;
}

const STATUS_TONE: Record<BasketStatus, BadgeTone> = {
  open: 'success',
  ready: 'warning',
  completed: 'primary',
};

export function BasketPreviewCard({ basket, onPress, compact = false }: BasketPreviewCardProps) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === 'ar';
  const Arrow = rtl ? ArrowLeft : ArrowRight;
  const total = basketTotal(basket);
  const progress = basketProgress(basket);
  const boxSize = compact ? 92 : 112;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={basket.name}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card tone={basket.status === 'completed' ? 'surface' : 'lavender'} style={styles.card}>
        <View style={styles.row}>
          <View style={styles.boxWrap}>
            <GiftBox3D basket={basket} size={boxSize} interactive={false} idle showMeta={false} />
          </View>

          <View style={styles.body}>
            <View style={styles.topRow}>
              <Badge label={t(`basket.status.${basket.status}`)} tone={STATUS_TONE[basket.status]} />
              <View style={styles.arrow}>
                <Arrow size={14} color={colors.ink} />
              </View>
            </View>

            <Text style={styles.name} numberOfLines={1}>
              {basket.name}
            </Text>
            <Text style={styles.recipient} numberOfLines={1}>
              {t('basket.forRecipient', { name: basket.recipient_name })}
            </Text>

            <View style={styles.metaRow}>
              <Users size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>
                {t('basket.peopleCount', { count: basket.participants.length })}
              </Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.metaText}>
                {t('basket.cardsCount', { count: basket.items.length })}
              </Text>
            </View>

            <View style={styles.footer}>
              <Money minor={total} style={styles.amount} />
              <ParticipantStack participants={basket.participants} size={24} max={3} />
            </View>

            {basket.target_minor > 0 ? (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progress}%`,
                        backgroundColor: basket.status === 'completed' ? colors.gold : colors.teal,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>{progress}%</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  card: { padding: spacing.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  boxWrap: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: 2,
  },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  recipient: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  dot: { color: colors.textMuted, fontSize: fontSizes.xs },
  footer: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  amount: { fontSize: fontSizes.lg, color: colors.text },
  progressWrap: { marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: radii.pill },
  progressText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  pressed: { opacity: 0.9, transform: [{ translateY: 2 }] },
}));
