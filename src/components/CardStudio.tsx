// src/components/CardStudio.tsx
// The card designer overlay. A small cover tile on the Create a gift page
// expands upward into a full-screen takeover (X to minimise). It shows all
// covers; choosing one grows the card, flips it to the beige back and turns it
// into a carousel where the sender writes / records / attaches media.
//
// This is an in-screen overlay, not a route, so the animation never breaks.
// The same overlay is reusable by other card flows.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleProp, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';

import { coverLabel, fetchGiftCovers, GIFT_COVERS, resolveCover, type GiftCover } from '../lib/gift-covers';
import type { CardBackItem } from './CardBack';
import { CardBack } from './CardBack';
import { GiftCoverArt } from './GiftCoverArt';
import { Glyph } from './Glyph';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';

interface CardStudioProps {
  /** Currently chosen cover id, kept in the gift draft. */
  coverId: string;
  /** Called when the sender picks a cover. */
  onCoverChange: (coverId: string) => void;
  /** Message written on the back. */
  message: string;
  onMessageChange: (value: string) => void;
  /** Media items attached to the back (photos, GIFs, video, voice). */
  items: CardBackItem[];
  onItemsChange: (items: CardBackItem[]) => void;
  /** Called when the sender finishes the card. */
  onDone?: () => void;
  /** Optional trigger rendered inline; defaults to a small cover tile. */
  triggerStyle?: StyleProp<ViewStyle>;
}

type Phase = 'closed' | 'grid' | 'card';

export function CardStudio({
  coverId,
  onCoverChange,
  message,
  onMessageChange,
  items,
  onItemsChange,
  onDone,
  triggerStyle,
}: CardStudioProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>('closed');
  const [covers, setCovers] = useState<GiftCover[]>(GIFT_COVERS);
  const [flipped, setFlipped] = useState(false);
  const open = useSharedValue(0);
  const focus = useSharedValue(0);
  const flip = useSharedValue(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    fetchGiftCovers().then((items) => mounted.current && setCovers(items));
    return () => {
      mounted.current = false;
    };
  }, []);

  function show() {
    setPhase('grid');
    setFlipped(false);
    open.value = withSpring(1, { damping: 22, stiffness: 220 });
    focus.value = withTiming(0, { duration: 260 });
    flip.value = withTiming(0, { duration: 260 });
  }

  function minimise() {
    open.value = withTiming(0, { duration: 240 }, (finished) => {
      if (finished) setPhase('closed');
    });
  }

  function chooseCover(id: string) {
    onCoverChange(id);
    setPhase('card');
    focus.value = withSpring(1, { damping: 20, stiffness: 200 });
  }

  function flipCard() {
    const next = !flipped;
    setFlipped(next);
    flip.value = withTiming(next ? 1 : 0, { duration: 380 });
  }

  function done() {
    onDone?.();
    minimise();
  }

  const selected = resolveCover(coverId, covers);

  // The overlay slides up from the tile and fades in.
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [{ translateY: interpolate(open.value, [0, 1], [height * 0.25, 0], Extrapolation.CLAMP) }],
  }));
  // The grid fades out and the card fades/scales in as focus grows.
  const gridStyle = useAnimatedStyle(() => ({
    opacity: 1 - focus.value,
    transform: [{ scale: interpolate(focus.value, [0, 1], [1, 0.92], Extrapolation.CLAMP) }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scale: interpolate(focus.value, [0, 1], [0.7, 1], Extrapolation.CLAMP) }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: 1 - flip.value,
    transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value,
    transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [-180, 0], Extrapolation.CLAMP)}deg` }],
  }));

  const tileWidth = Math.min(150, Math.max(96, Math.round(width * 0.34)));
  const tileHeight = Math.round(tileWidth * 1.5);
  const gridTileWidth = Math.min(150, Math.floor((width - spacing.gutter * 2 - spacing.sm * 2) / 3));
  const gridTileHeight = Math.round(gridTileWidth * 1.4);
  const cardWidth = Math.min(width - spacing.gutter * 2, 300);
  const cardHeight = Math.min(height * 0.72, cardWidth * 1.6);

  return (
    <>
      {/* Inline trigger: a small version of the chosen card, blurred, with a
          clear Choose cover button in the middle. */}
      <Pressable onPress={show} accessibilityRole="button" accessibilityLabel={t('send.chooseCover')} style={[styles.trigger, triggerStyle]}>
        <View style={[styles.triggerCard, { width: tileWidth, height: tileHeight }]}>
          <GiftCoverArt coverId={selected.id} coverImageUrl={selected.imageUrl} coverName={coverLabel(selected, t)} height={tileHeight} compact />
          <BlurView intensity={18} tint="light" style={styles.triggerBlur} />
          <View style={styles.triggerButton}>
            <Glyph name="palette" size={18} color={colors.textOnInk} />
            <Text style={styles.triggerLabel}>{t('send.chooseCover')}</Text>
          </View>
        </View>
      </Pressable>

      <Modal visible={phase !== 'closed'} transparent statusBarTranslucent animationType="none" onRequestClose={minimise}>
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <View style={styles.topBar}>
            <Text style={styles.overlayTitle}>
              {phase === 'grid' ? t('send.chooseCover') : t('cardBack.title')}
            </Text>
            <Pressable onPress={minimise} accessibilityRole="button" accessibilityLabel={t('cardBack.close')} style={styles.close}>
              <Glyph name="x" size={22} color={colors.text} />
            </Pressable>
          </View>

          {/* Grid phase: all covers, best-fit in three columns. */}
          <Animated.View style={[styles.gridWrap, gridStyle]} pointerEvents={phase === 'grid' ? 'auto' : 'none'}>
            <View style={styles.grid}>
              {covers.map((cover) => {
                const active = cover.id === coverId;
                return (
                  <Pressable
                    key={cover.id}
                    onPress={() => chooseCover(cover.id)}
                    accessibilityRole="button"
                    accessibilityLabel={coverLabel(cover, t)}
                    style={({ pressed }) => [styles.gridTile, active && styles.gridTileActive, pressed && styles.pressed]}
                  >
                    <GiftCoverArt coverId={cover.id} coverImageUrl={cover.imageUrl} coverName={coverLabel(cover, t)} height={gridTileHeight - 6} compact />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Card phase: front flips to the beige back, which is the carousel
              of writing, voice, GIFs, photos and video. */}
          {phase === 'card' ? (
            <Animated.View style={[styles.cardWrap, cardStyle]}>
              <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
                <Animated.View style={[styles.cardFace, frontStyle]}>
                  <GiftCoverArt coverId={selected.id} coverImageUrl={selected.imageUrl} coverName={coverLabel(selected, t)} height={cardHeight} />
                  <Pressable onPress={() => chooseCover(selected.id)} accessibilityRole="button" accessibilityLabel={t('send.chooseCover')} style={styles.changeCover}>
                    <Glyph name="palette" size={16} color={colors.textOnInk} />
                    <Text style={styles.changeCoverLabel}>{t('cardBack.changeCover')}</Text>
                  </Pressable>
                </Animated.View>
                <Animated.View style={[styles.cardFace, styles.cardBackFace, backStyle]}>
                  <CardBack message={message} onMessageChange={onMessageChange} items={items} onItemsChange={onItemsChange} />
                </Animated.View>
              </View>
              <View style={styles.cardActions}>
                <Pressable onPress={flipCard} accessibilityRole="button" accessibilityLabel={flipped ? t('cardBack.showFront') : t('cardBack.writeOnBack')} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                  <Glyph name={flipped ? 'eye' : 'pen'} size={18} color={colors.text} />
                  <Text style={styles.actionLabel}>{flipped ? t('cardBack.showFront') : t('cardBack.writeOnBack')}</Text>
                </Pressable>
                <Pressable onPress={done} accessibilityRole="button" accessibilityLabel={t('common.done')} style={({ pressed }) => [styles.action, styles.actionPrimary, pressed && styles.pressed]}>
                  <Glyph name="check" size={18} color={colors.textOnInk} />
                  <Text style={[styles.actionLabel, styles.actionPrimaryLabel]}>{t('common.done')}</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = themedStyles(() => ({
  trigger: { alignSelf: 'center' },
  triggerCard: { position: 'relative', borderRadius: radii.lg, borderWidth: 3, borderColor: colors.border, overflow: 'hidden' },
  triggerBlur: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderRadius: radii.md },
  triggerButton: {
    position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radii.pill, backgroundColor: colors.danger, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  triggerLabel: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.textOnInk },
  overlay: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.xl, paddingHorizontal: spacing.gutter },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  overlayTitle: { flex: 1, fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.text },
  close: { width: 44, height: 44, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  gridWrap: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  gridTile: { borderRadius: radii.md, borderWidth: 3, borderColor: 'transparent', overflow: 'hidden' },
  gridTileActive: { borderColor: colors.danger },
  cardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  card: { position: 'relative', borderRadius: radii.lg, borderWidth: 3, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.surface },
  cardFace: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden' },
  cardBackFace: { backgroundColor: '#E8DCC3' },
  changeCover: { position: 'absolute', bottom: spacing.sm, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radii.pill, backgroundColor: colors.danger, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  changeCoverLabel: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.textOnInk },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radii.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  actionPrimary: { backgroundColor: colors.danger, borderColor: colors.border },
  actionLabel: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  actionPrimaryLabel: { color: colors.textOnInk },
  pressed: { opacity: 0.85 },
}));
