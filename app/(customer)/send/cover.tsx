import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { G, Line } from 'react-native-svg';

import { BackButton } from '@/src/components/BackButton';
import { GiftCoverArt } from '@/src/components/GiftCoverArt';
import { Screen } from '@/src/components/Screen';
import { GIFT_COVERS } from '@/src/lib/gift-covers';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

/** A faint field of sparkles behind the cover grid, as on a printed card. */
function SparkleBackdrop() {
  const sparkles: React.ReactNode[] = [];
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = 22 + col * 52 + (row % 2 === 0 ? 0 : 26);
      const y = 26 + row * 56;
      sparkles.push(
        <G key={`${row}-${col}`} transform={`translate(${x} ${y})`}>
          <Line x1={-6} y1={0} x2={6} y2={0} stroke={colors.coverBackdropPattern} strokeWidth={1.6} />
          <Line x1={0} y1={-6} x2={0} y2={6} stroke={colors.coverBackdropPattern} strokeWidth={1.6} />
          <Line x1={-4} y1={-4} x2={4} y2={4} stroke={colors.coverBackdropPattern} strokeWidth={1.6} />
          <Line x1={-4} y1={4} x2={4} y2={-4} stroke={colors.coverBackdropPattern} strokeWidth={1.6} />
        </G>,
      );
    }
  }
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <Svg width="100%" height="100%" viewBox="0 0 200 420" preserveAspectRatio="xMidYMid slice">
        {sparkles}
      </Svg>
    </View>
  );
}

/**
 * Cover chooser: a full-bleed gallery of printed card designs, with the chosen
 * one stepped forward. The photo and sticker tools live on the card editor that
 * follows, so this screen stays about picking a cover.
 */
export default function CoverScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { draft, update } = useGiftDraft();
  const { width } = useWindowDimensions();

  // Three tall covers per row, like a print catalogue. Capped so the tiles
  // stay postcard-sized on tablets and centred rows do not stretch.
  const tileWidth = Math.min(
    160,
    Math.floor((width - spacing.gutter * 2 - spacing.sm * 2) / 3),
  );
  const tileHeight = Math.round(tileWidth * 1.8);

  return (
    <Screen scroll hideBlobs style={styles.screen} contentStyle={styles.content}>
      <SparkleBackdrop />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('send.chooseCover')}
        </Text>
        <Pressable
          onPress={() => router.push('/(customer)/send/decorate')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          <Text style={styles.ctaLabel}>{t('send.next')}</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {GIFT_COVERS.map((cover) => {
          const active = draft.cover === cover.id;
          return (
            <Pressable
              key={cover.id}
              onPress={() => update({ cover: cover.id })}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(`send.coverNames.${cover.nameKey}`)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View
                style={[
                  styles.tile,
                  { width: tileWidth, height: tileHeight },
                  active && styles.tileActive,
                ]}
              >
                <GiftCoverArt coverId={cover.id} height={tileHeight - 6} compact />
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  screen: { backgroundColor: colors.coverBackdrop },
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.onCover,
  },
  cta: {
    minWidth: 74,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  ctaLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.textOnInk,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.sm,
    rowGap: spacing.sm + 2,
  },
  tile: {
    borderRadius: radii.md + 2,
    borderWidth: 3,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  tileActive: { borderColor: colors.onCover },
  pressed: { opacity: 0.9 },
}));
