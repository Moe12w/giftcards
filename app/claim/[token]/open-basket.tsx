import { useThemeRefresh } from '@/src/lib/theme';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';
import { fetchClaimBasket, type ClaimBasket } from '@/src/lib/claim';

export default function ClaimOpenBasketScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [basket, setBasket] = useState<ClaimBasket | null>(null);
  const [opened, setOpened] = useState(false);

  const bookScale = useState(() => new Animated.Value(0.7))[0];
  const coverRotate = useState(() => new Animated.Value(0))[0];
  const cardsSlide = useState(() => new Animated.Value(0))[0];
  const sparkleOpacity = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    let active = true;
    if (!token) return;
    fetchClaimBasket(token)
      .then((row) => active && setBasket(row))
      .catch(() => active && setBasket(null));
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    Animated.spring(bookScale, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [bookScale]);

  function handleOpen() {
    if (opened) return;
    setOpened(true);

    Animated.sequence([
      Animated.timing(coverRotate, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardsSlide, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.back(1.1)),
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
      }, 800);
    });
  }

  const coverRotation = coverRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-150deg'],
  });

  const cardsTranslateX = cardsSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  });

  const cardsTranslateY = cardsSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -40],
  });

  const cardsOpacity = cardsSlide.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.5, 1],
  });

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        {/* Decorative blobs */}
        <View style={styles.blobTeal} />
        <View style={styles.blobPink} />

        {/* Sparkles */}
        <Animated.View style={[styles.sparkleContainer, { opacity: sparkleOpacity }]}>
          <Glyph name="star" size={22} color={colors.gold} style={styles.sparkle1} />
          <Glyph name="star" size={16} color={colors.pink} style={styles.sparkle2} />
          <Glyph name="star" size={20} color={colors.teal} style={styles.sparkle3} />
          <Glyph name="star" size={14} color={colors.gold} style={styles.sparkle4} />
        </Animated.View>

        {/* Book */}
        <Animated.View style={[styles.bookWrapper, { transform: [{ scale: bookScale }] }]}>
          {/* Gift cards sliding out */}
          <Animated.View
            style={[
              styles.cardsContainer,
              {
                opacity: cardsOpacity,
                transform: [
                  { translateX: cardsTranslateX },
                  { translateY: cardsTranslateY },
                ],
              },
            ]}
          >
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.cardPreview,
                  {
                    transform: [
                      { rotate: i === 0 ? '-8deg' : i === 1 ? '2deg' : '10deg' },
                      { translateX: (i - 1) * 20 },
                      { translateY: (i - 1) * -8 },
                    ],
                    zIndex: 3 - i,
                  },
                ]}
              >
                <View style={styles.cardPreviewInner}>
                  <Glyph name="gift" size={20} color={colors.textOnPastel} />
                </View>
              </View>
            ))}
          </Animated.View>

          {/* Book cover */}
          <Animated.View
            style={[
              styles.bookCover,
              { transform: [{ rotateY: coverRotation }] },
            ]}
          >
            <View style={styles.bookCoverInner}>
              <Glyph name="book" size={40} color={colors.textOnPastel} />
              <Text style={styles.bookTitle}>{basket?.name ?? 'Gift Book'}</Text>
            </View>
            <View style={styles.bookSpine} />
          </Animated.View>

          {/* Book pages (behind cover) */}
          <View style={styles.bookPages}>
            <View style={styles.bookPage} />
            <View style={[styles.bookPage, styles.bookPageBack]} />
          </View>
        </Animated.View>

        <Text style={styles.title}>
          {opened
            ? t('claimExtra.revealTitle')
            : t('basket.claimTitle', { defaultValue: 'A gift book for you' })}
        </Text>
        <Text style={styles.subtitle}>
          {opened
            ? t('basket.forRecipient', { name: basket?.recipientName ?? '' })
            : t('basket.claimBody', { defaultValue: 'Tap to open your gift book' })}
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
  blobTeal: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.tealTint,
    transform: [{ translateX: -70 }, { translateY: -60 }],
  },
  blobPink: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.pinkTint,
    transform: [{ translateX: 80 }, { translateY: 80 }],
  },
  sparkleContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  sparkle1: { position: 'absolute', top: 30, left: '15%' },
  sparkle2: { position: 'absolute', top: 15, right: '20%' },
  sparkle3: { position: 'absolute', top: 50, left: '45%' },
  sparkle4: { position: 'absolute', top: 25, right: '35%' },
  bookWrapper: {
    width: 220,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  cardsContainer: {
    position: 'absolute',
    top: 40,
    zIndex: 1,
  },
  cardPreview: {
    width: 140,
    height: 85,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: colors.border,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardPreviewInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookCover: {
    width: 180,
    height: 230,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: colors.border,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 2, height: 4 },
  },
  bookCoverInner: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  bookTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.textOnPastel,
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
  },
  bookSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 12,
    backgroundColor: colors.tealDark,
    borderTopLeftRadius: radii.md,
    borderBottomLeftRadius: radii.md,
  },
  bookPages: {
    position: 'absolute',
    width: 170,
    height: 220,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    zIndex: 0,
  },
  bookPage: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: radii.sm - 1,
    backgroundColor: colors.surfaceAlt,
  },
  bookPageBack: {
    top: 8,
    left: 8,
    right: 2,
    bottom: 2,
    backgroundColor: colors.surface,
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