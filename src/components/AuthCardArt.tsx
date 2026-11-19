// src/components/AuthCardArt.tsx
// Large, decorative card artwork for the auth flow — the same sticker cards as
// the website's landing hero (pastel plates, ink outlines, an outlined circle),
// stacked and tilted. No icon plates or gift glyphs.
import React, { useEffect, useState } from 'react';
import { Animated, Text, View } from 'react-native';

import { colors, fontSizes, fonts, radii, spacing, themedStyles } from '../theme';

interface AuthCardArtProps {
  /** `hero` fills the intro screen; `step` is shorter for the form screens. */
  size?: 'hero' | 'step';
}

function CardPlate({
  brand,
  amount,
  meta,
  color,
}: {
  brand: string;
  amount: string;
  meta: string;
  color: string;
}) {
  // Colours are passed in as live palette values; the wrapper handles layout.
  return (
    <View style={[styles.plate, { backgroundColor: color }]}>
      <View style={styles.plateCircle} />
      <View style={styles.plateTop}>
        <Text style={styles.brand} numberOfLines={1}>
          {brand}
        </Text>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{meta}</Text>
        </View>
      </View>
      <View style={styles.plateBottom}>
        <Text style={styles.amount}>{amount}</Text>
        <Text style={styles.currency}>QAR</Text>
      </View>
    </View>
  );
}

export function AuthCardArt({ size = 'hero' }: AuthCardArtProps) {
  // A state-held Animated.Value keeps the lint rules happy (no ref access
  // during render) and is stable for the lifetime of the component.
  const [float] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -8, duration: 2200, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const hero = size === 'hero';

  return (
    <View style={[styles.wrap, hero ? styles.hero : styles.step]} pointerEvents="none">
      <View style={[styles.blob, hero ? styles.blobHero : styles.blobStep]} />
      <View style={[styles.stack, hero ? styles.stackHero : styles.stackStep]}>
        <Animated.View style={[styles.float, { transform: [{ translateY: float }] }]}>
          <View style={[styles.position, styles.back]}>
            <CardPlate brand="Café Lane" amount="150" meta="CARD" color={colors.lavender} />
          </View>
          <View style={[styles.position, styles.middle]}>
            <CardPlate brand="Dune Spa" amount="250" meta="SPA" color={colors.pink} />
          </View>
          <View style={[styles.position, styles.front]}>
            <CardPlate brand="Giftly" amount="500" meta="GIFT" color={colors.teal} />
          </View>
        </Animated.View>
      </View>
      <View style={[styles.sparkle, styles.sparkleA]} />
      <View style={[styles.sparkle, styles.sparkleB]} />
      <View style={[styles.sparkleDot]} />
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  hero: { height: 276, marginBottom: spacing.xs },
  step: { height: 182, marginBottom: spacing.xs },
  blob: {
    position: 'absolute',
    borderRadius: 200,
    backgroundColor: colors.lavenderTint,
  },
  blobHero: { width: 300, height: 240, transform: [{ translateX: 24 }, { translateY: 12 }] },
  blobStep: { width: 250, height: 180, transform: [{ translateX: 18 }, { translateY: 8 }] },
  stack: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  stackHero: {},
  stackStep: { transform: [{ scale: 0.82 }] },
  float: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  position: { position: 'absolute' },
  back: { transform: [{ rotate: '-10deg' }, { translateX: -52 }, { translateY: -22 }] },
  middle: { transform: [{ rotate: '8deg' }, { translateX: 48 }, { translateY: 20 }] },
  front: { transform: [{ rotate: '-2deg' }], zIndex: 3 },
  plate: {
    width: 214,
    height: 132,
    borderRadius: radii.offer,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.sm + 3,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  plateCircle: {
    position: 'absolute',
    right: -34,
    bottom: -52,
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  plateTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', zIndex: 1 },
  brand: { fontFamily: fonts.extrabold, fontSize: fontSizes.md, color: colors.ink },
  tag: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  tagText: { fontFamily: fonts.extrabold, fontSize: 9, color: colors.ink },
  plateBottom: { flexDirection: 'row', alignItems: 'baseline', gap: 5, zIndex: 1 },
  amount: { fontFamily: fonts.black, fontSize: 36, letterSpacing: -1.5, color: colors.ink },
  currency: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.ink },
  sparkle: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.gold,
  },
  sparkleA: { top: 24, right: 46, transform: [{ rotate: '18deg' }] },
  sparkleB: { bottom: 40, left: 40, backgroundColor: colors.pink, transform: [{ rotate: '-12deg' }] },
  sparkleDot: {
    position: 'absolute',
    top: 56,
    left: 56,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal,
  },
}));
