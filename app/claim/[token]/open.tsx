import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function ClaimOpenScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        <View style={styles.blobPink} />
        <View style={styles.blobTeal} />
        <Pressable
          onPress={() => router.push(`/claim/${token}/reveal`)}
          accessibilityRole="button"
          accessibilityLabel={t('claimExtra.revealBody')}
          style={({ pressed }) => [styles.box, pressed && styles.pressed]}
        >
          <Glyph name="gift" size={40} />
          <Glyph name="star" size={16} color={colors.gold} />
        </Pressable>
        <Text style={styles.title}>{t('claimExtra.revealTitle')}</Text>
        <Text style={styles.body}>{t('claimExtra.revealBody')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center', gap: spacing.sm },
  blobPink: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: colors.pinkTint,
    transform: [{ translateX: 22 }, { translateY: -10 }],
  },
  blobTeal: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.tealTint,
    transform: [{ translateX: -70 }, { translateY: 70 }],
  },
  box: {
    width: 190,
    height: 190,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.display,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
