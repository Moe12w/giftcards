import { useThemeRefresh } from '@/src/lib/theme';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';
import { fetchClaimGift, type ClaimGift } from '@/src/lib/claim';

export default function ClaimOpenEnvelopeScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [gift, setGift] = useState<ClaimGift | null>(null);
  const [opened, setOpened] = useState(false);

  const envelopeScale = useState(() => new Animated.Value(0.8))[0];
  const flapRotate = useState(() => new Animated.Value(0))[0];
  const cardSlide = useState(() => new Animated.Value(0))[0];
  const noteSlide = useState(() => new Animated.Value(0))[0];
  const sparkleOpacity = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    let active = true;
    if (!token) return;
    fetchClaimGift(token)
      .then((row) => active && setGift(row))
      .catch(() => active && setGift(null));
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    Animated.spring(envelopeScale, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [envelopeScale]);

  function handleOpen() {
    if (opened) return;
    setOpened(true);

    Animated.sequence([
      Animated.timing(flapRotate, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardSlide, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(noteSlide, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sparkleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        router.push(`/claim/${token}/add`);
      }, 600);
    });
  }

  const flapRotation = flapRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-120deg'],
  });

  const cardTranslateY = cardSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -120],
  });

  const cardScale = cardSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  const noteTranslateY = noteSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -80],
  });

  const noteTranslateX = noteSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 15],
  });

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        {/* Decorative blobs */}
        <View style={styles.blobPink} />
        <View style={styles.blobTeal} />

        {/* Sparkles */}
        <Animated.View style={[styles.sparkleContainer, { opacity: sparkleOpacity }]}>
          <Glyph name="star" size={20} color={colors.gold} style={styles.sparkle1} />
          <Glyph name="star" size={14} color={colors.pink} style={styles.sparkle2} />
          <Glyph name="star" size={18} color={colors.teal} style={styles.sparkle3} />
        </Animated.View>

        {/* Envelope */}
        <Animated.View style={[styles.envelopeWrapper, { transform: [{ scale: envelopeScale }] }]}>
          {/* Note (behind card) */}
          <Animated.View
            style={[
              styles.note,
              {
                transform: [
                  { translateY: noteTranslateY },
                  { translateX: noteTranslateX },
                  { rotate: '3deg' },
                ],
              },
            ]}
          >
            <View style={styles.noteLines}>
              <View style={styles.noteLine} />
              <View style={[styles.noteLine, styles.noteLineShort]} />
              <View style={[styles.noteLine, styles.noteLineShorter]} />
            </View>
          </Animated.View>

          {/* Gift card (slides up and out) */}
          <Animated.View
            style={[
              styles.card,
              {
                transform: [
                  { translateY: cardTranslateY },
                  { scale: cardScale },
                ],
              },
            ]}
          >
            <View style={styles.cardInner}>
              <Glyph name="gift" size={32} color={colors.textOnPastel} />
              <Text style={styles.cardTitle}>{gift?.vendor ?? 'Gift'}</Text>
              <Text style={styles.cardAmount}>
                {gift ? `QAR ${(gift.amountMinor / 100).toFixed(0)}` : ''}
              </Text>
            </View>
          </Animated.View>

          {/* Envelope body */}
          <View style={styles.envelope}>
            <Animated.View
              style={[
                styles.flap,
                { transform: [{ rotateX: flapRotation }] },
              ]}
            />
            <View style={styles.envelopeFront}>
              <View style={styles.envelopeSeal}>
                <Glyph name="heart" size={16} color={colors.textOnPastel} />
              </View>
            </View>
          </View>
        </Animated.View>

        <Text style={styles.title}>
          {opened ? t('claimExtra.revealTitle') : t('claimExtra.revealBody')}
        </Text>
        <Text style={styles.subtitle}>
          {opened
            ? t('claimExtra.from', { name: gift?.sender ?? '' })
            : t('claimExtra.revealBody')}
        </Text>

        {!opened ? (
          <Button
            label={t('claimExtra.openCta', { defaultValue: 'Open your gift' })}
            onPress={handleOpen}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  content: { flex: 1, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  blobPink: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: colors.pinkTint,
    transform: [{ translateX: 60 }, { translateY: -80 }],
  },
  blobTeal: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.tealTint,
    transform: [{ translateX: -80 }, { translateY: 60 }],
  },
  sparkleContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  sparkle1: { position: 'absolute', top: 40, left: '20%' },
  sparkle2: { position: 'absolute', top: 20, right: '25%' },
  sparkle3: { position: 'absolute', top: 60, left: '40%' },
  envelopeWrapper: {
    width: 220,
    height: 260,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: spacing.lg,
  },
  note: {
    position: 'absolute',
    bottom: 60,
    width: 160,
    height: 100,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
    zIndex: 1,
  },
  noteLines: { gap: 6, marginTop: spacing.xs },
  noteLine: { height: 3, borderRadius: 2, backgroundColor: colors.borderSoft, width: '90%' },
  noteLineShort: { width: '60%' },
  noteLineShorter: { width: '75%' },
  card: {
    position: 'absolute',
    bottom: 70,
    width: 180,
    height: 110,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  cardInner: { alignItems: 'center', gap: spacing.xs },
  cardTitle: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.textOnPastel },
  cardAmount: { fontFamily: fonts.extrabold, fontSize: fontSizes.xl, color: colors.textOnPastel },
  envelope: {
    width: 200,
    height: 130,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.lavenderCard,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 3,
  },
  flap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 65,
    backgroundColor: colors.lavender,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  envelopeFront: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderCard,
  },
  envelopeSeal: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.pink,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
}));