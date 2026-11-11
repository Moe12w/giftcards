// src/components/GiftBox3D.tsx
// A lightweight, dependency-free 3D-style gift box. It uses React Native's
// native-driven Animated transforms (perspective + rotateY) so it stays smooth
// on iOS, Android and web without pulling in WebGL or native 3D modules.
//
// Interactions:
//  - tap the box to open / close the lid
//  - drag horizontally to rotate it (springs back when released)
//  - vouchers visibly fly in whenever the basket gains a card
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Star } from 'lucide-react-native';

import type { AccentTone, BasketItem, GiftBasket } from '../lib/types';
import { resolveTone } from '../lib/tone';
import { basketTotal } from '../lib/baskets';
import { colors, edges, fonts, fontSizes, radii, spacing } from '../theme';
import { Glyph } from './Glyph';
import { Money } from './Money';

interface GiftBox3DProps {
  basket: GiftBasket;
  size?: number;
  interactive?: boolean;
  defaultOpen?: boolean;
  showMeta?: boolean;
  /** Disables the auto-rotation (useful for small previews). */
  idle?: boolean;
}

const PALETTE: Record<AccentTone, { face: string; edge: string; ribbon: string }> = {
  teal: { face: colors.teal, edge: edges.teal, ribbon: colors.pink },
  pink: { face: colors.pink, edge: edges.pink, ribbon: colors.lavender },
  lavender: { face: colors.lavender, edge: edges.lavender, ribbon: colors.gold },
  gold: { face: colors.gold, edge: edges.gold, ribbon: colors.pink },
  sky: { face: colors.sky, edge: edges.ink, ribbon: colors.teal },
};

function newestItem(basket: GiftBasket): BasketItem | null {
  return basket.items[basket.items.length - 1] ?? null;
}

/**
 * A playful mini gift card for the box and the flying animation. It is
 * deliberately vendor-neutral — colour, ribbon and a glyph, never a logo.
 */
function MiniGiftCard({
  tone = 'lavender',
  icon = 'gift',
  size = 30,
}: {
  tone?: AccentTone;
  icon?: string | null;
  size?: number;
}) {
  const palette = PALETTE[tone] ?? PALETTE.lavender;
  return (
    <View
      style={[
        styles.miniCard,
        { width: size * 1.25, height: size, backgroundColor: palette.face },
      ]}
    >
      <View style={[styles.miniCardBand, { backgroundColor: palette.ribbon }]} />
      <View style={styles.miniCardGlyph}>
        <Glyph name={icon} size={size * 0.38} />
      </View>
      <View style={styles.miniCardDot} />
    </View>
  );
}

export function GiftBox3D({
  basket,
  size = 260,
  interactive = true,
  defaultOpen = false,
  showMeta = true,
  idle = false,
}: GiftBox3DProps) {
  const [open, setOpen] = useState(defaultOpen);
  const rotation = useRef(new Animated.Value(0)).current;
  const lid = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  const fly = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const prevCount = useRef(basket.items.length);
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const tone = resolveTone(basket.items[0]?.tone);
  const palette = PALETTE[tone] ?? PALETTE.lavender;
  const completed = basket.status !== 'open';
  const total = basketTotal(basket);
  const latest = newestItem(basket);

  // Gentle idle sway so the box always feels alive.
  useEffect(() => {
    if (!interactive || idle) {
      rotation.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rotation, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotation, {
          toValue: -1,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      loopRef.current = null;
    };
  }, [idle, interactive, rotation]);

  // Confetti / sparkle pulse for ready and completed baskets.
  useEffect(() => {
    if (!completed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [completed, pulse]);

  // Open or close the lid.
  useEffect(() => {
    Animated.spring(lid, {
      toValue: open ? 1 : 0,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [lid, open]);

  // Once the group gift is wrapped, the lid stays shut with the ribbon on.
  useEffect(() => {
    if (basket.status !== 'open') setOpen(false);
  }, [basket.status]);

  // Fly the newest voucher into the box when the contents grow, and pop the
  // lid open so the new gift is visible.
  useEffect(() => {
    if (basket.items.length > prevCount.current) {
      if (basket.status === 'open') setOpen(true);
      fly.setValue(0);
      Animated.timing(fly, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    prevCount.current = basket.items.length;
  }, [basket.items.length, basket.status, fly]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gesture) => interactive && Math.abs(gesture.dx) > 8,
      onPanResponderGrant: () => loopRef.current?.stop(),
      onPanResponderMove: (_event, gesture) => {
        const next = Math.max(-1.4, Math.min(1.4, gesture.dx / 90));
        rotation.setValue(next);
      },
      onPanResponderRelease: () => {
        Animated.spring(rotation, {
          toValue: 0,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }).start(() => loopRef.current?.start());
      },
    }),
  ).current;

  const boxW = size * 0.72;
  const boxH = size * 0.52;
  const lidH = size * 0.15;
  const stageH = size * 0.86;

  const rotateY = rotation.interpolate({
    inputRange: [-1.4, 0, 1.4],
    outputRange: ['-32deg', '0deg', '32deg'],
  });

  const lidTranslate = lid.interpolate({ inputRange: [0, 1], outputRange: [0, -lidH * 1.35] });
  const lidRotate = lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-14deg'] });
  const lidOpacity = lid.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1, 0.96] });

  const flyTranslateY = fly.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.55, -size * 0.02] });
  const flyScale = fly.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1.1, 1, 0.6] });
  const flyOpacity = fly.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });

  const visibleVouchers = basket.items.slice(-4);

  return (
    <View style={[styles.wrapper, { width: size }]}>
      <View style={[styles.stage, { height: stageH, width: size }]} {...pan.panHandlers}>
        {/* Confetti for a finished gift */}
        {completed ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: pulseOpacity }]}
          >
            {CONFETTI.map((dot, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.confetti,
                  {
                    left: (dot.left / 100) * size,
                    top: (dot.top / 100) * stageH,
                    backgroundColor: dot.color,
                    transform: [{ scale: pulseScale }, { rotate: `${dot.rotate}deg` }],
                  },
                ]}
              />
            ))}
          </Animated.View>
        ) : null}

        <View
          style={[
            styles.floorShadow,
            { width: boxW * 0.9, height: size * 0.06, bottom: size * 0.02 },
          ]}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close gift box' : 'Open gift box'}
          onPress={() => setOpen((value) => !value)}
          style={[styles.boxHit, { width: boxW, height: stageH * 0.82 }]}
        >
          <Animated.View
            style={[
              styles.box,
              {
                width: boxW,
                height: boxH,
                bottom: size * 0.05,
                transform: [{ perspective: 900 }, { rotateY }],
              },
            ]}
          >
            {/* Inner shadow visible when the lid opens */}
            <View style={[styles.inner, { height: boxH * 0.55 }]} />

            {/* Vouchers peeking out of the open box */}
            {open ? (
              <View style={[styles.voucherRow, { bottom: boxH * 0.42 }]}>
                {visibleVouchers.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.voucher,
                      {
                        transform: [{ rotate: `${(index - 1.5) * 4}deg` }],
                        zIndex: index,
                      },
                    ]}
                  >
                    <MiniGiftCard
                      tone={resolveTone(item.tone)}
                      icon={item.icon}
                      size={28}
                    />
                  </View>
                ))}
                {basket.items.length > 4 ? (
                  <View style={styles.moreVouchers}>
                    <Text style={styles.moreVouchersText}>+{basket.items.length - 4}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Box front */}
            <View style={[styles.face, { backgroundColor: palette.face }]}>
              <View style={[styles.ribbonVertical, { backgroundColor: palette.ribbon }]} />
              <View style={[styles.ribbonHorizontal, { backgroundColor: palette.ribbon }]} />
              <View style={styles.frontBadge}>
                <Text style={styles.frontBadgeText}>
                  {basket.items.length} {basket.items.length === 1 ? 'gift' : 'gifts'}
                </Text>
              </View>
            </View>

            {/* Fake side depth */}
            <View style={[styles.side, { backgroundColor: palette.edge }]} />

            {/* Lid with its own ribbon and bow */}
            <Animated.View
              style={[
                styles.lid,
                {
                  height: lidH,
                  backgroundColor: palette.face,
                  opacity: lidOpacity,
                  transform: [{ translateY: lidTranslate }, { rotateZ: lidRotate }],
                },
              ]}
            >
              <View style={[styles.lidRibbon, { backgroundColor: palette.ribbon }]} />
              <View style={styles.bow}>
                <View style={[styles.bowLoop, styles.bowLeft, { backgroundColor: palette.ribbon }]} />
                <View style={[styles.bowLoop, styles.bowRight, { backgroundColor: palette.ribbon }]} />
                <View style={[styles.bowKnot, { backgroundColor: palette.ribbon }]} />
              </View>
            </Animated.View>

            {/* Finished-gift seal */}
            {completed ? (
              <View style={styles.seal}>
                <Star size={16} color={colors.ink} fill={colors.gold} />
              </View>
            ) : null}
          </Animated.View>

          {/* Voucher flying into the box */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.flyingVoucher,
              {
                opacity: flyOpacity,
                transform: [{ translateY: flyTranslateY }, { scale: flyScale }],
              },
            ]}
          >
            <View style={styles.flyingVoucherInner}>
              <MiniGiftCard
                tone={resolveTone(latest?.tone)}
                icon={latest?.icon}
                size={34}
              />
              <View style={styles.flyingCopy}>
                <Text style={styles.flyingTitle} numberOfLines={1}>
                  {latest?.title ?? 'Gift card'}
                </Text>
                <Money minor={latest?.amount_minor ?? 0} style={styles.flyingAmount} />
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </View>

      {/* Live hint, sat just below the box so it never covers the artwork */}
      {interactive ? (
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>{open ? 'Tap to close' : 'Tap to open'}</Text>
        </View>
      ) : null}

      {showMeta ? (
        <View style={styles.metaRow}>
          <View style={styles.metaCopy}>
            <Text style={styles.metaLabel}>Basket value</Text>
            <Money minor={total} style={styles.metaAmount} />
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>{basket.participants.length} people</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const CONFETTI = [
  { left: 8, top: 12, color: colors.pink, rotate: 18 },
  { left: 22, top: 4, color: colors.gold, rotate: -12 },
  { left: 48, top: 2, color: colors.teal, rotate: 26 },
  { left: 74, top: 8, color: colors.lavender, rotate: -20 },
  { left: 90, top: 18, color: colors.pink, rotate: 8 },
  { left: 4, top: 44, color: colors.gold, rotate: -30 },
  { left: 94, top: 46, color: colors.teal, rotate: 14 },
  { left: 16, top: 70, color: colors.lavender, rotate: 22 },
  { left: 84, top: 72, color: colors.gold, rotate: -16 },
];

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  stage: { alignItems: 'center', justifyContent: 'flex-end' },
  floorShadow: {
    position: 'absolute',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(28, 28, 28, 0.14)',
    transform: [{ scaleY: 0.4 }],
  },
  boxHit: { alignItems: 'center', justifyContent: 'flex-end' },
  box: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: '#2A2340',
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.ink,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  side: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    right: -10,
    width: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.ink,
    opacity: 0.9,
  },
  ribbonVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 22,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.ink,
  },
  ribbonHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '42%',
    height: 22,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.ink,
  },
  frontBadge: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  frontBadgeText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.ink,
  },
  lid: {
    position: 'absolute',
    top: -12,
    left: -6,
    right: -6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  lidRibbon: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 22,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.ink,
  },
  bow: {
    position: 'absolute',
    top: -14,
    width: 58,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bowLoop: {
    position: 'absolute',
    width: 22,
    height: 18,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  bowLeft: { left: 4, transform: [{ rotate: '-22deg' }] },
  bowRight: { right: 4, transform: [{ rotate: '22deg' }] },
  bowKnot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  seal: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  voucherRow: {
    position: 'absolute',
    left: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 2,
  },
  voucher: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -3,
  },
  miniCard: {
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniCardBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 7,
    borderBottomWidth: 2,
    borderColor: colors.ink,
  },
  miniCardGlyph: { marginTop: 4 },
  miniCardDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  moreVouchers: {
    marginLeft: 4,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  moreVouchersText: { fontFamily: fonts.bold, fontSize: 9, color: colors.ink },
  flyingVoucher: {
    position: 'absolute',
    top: '6%',
    zIndex: 6,
  },
  flyingVoucherInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  flyingCopy: { gap: 0 },
  flyingTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.ink,
    maxWidth: 96,
  },
  flyingAmount: { fontSize: fontSizes.xs, color: colors.textMuted },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: -spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tapHintText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  metaRow: {
    width: '100%',
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaCopy: { gap: 0 },
  metaLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  metaAmount: { fontSize: fontSizes.xl, color: colors.text },
  metaPill: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  metaPillText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.ink,
  },
  confetti: {
    position: 'absolute',
    width: 8,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.ink,
  },
});
