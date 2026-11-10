import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function NotificationsPermissionScreen() {
  const { t } = useTranslation();

  function finish() {
    router.replace('/(customer)/(tabs)');
  }

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.illustration}>
        <View style={styles.blob} />
        <View style={styles.circle}>
          <Glyph name="bell" size={44} />
        </View>
        <Glyph name="star" size={18} color={colors.pink} style={styles.sparkleA} />
        <Glyph name="star" size={13} color={colors.gold} style={styles.sparkleB} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{t('authExtra.notificationsTitle')}</Text>
        <Text style={styles.body}>{t('authExtra.notificationsBody')}</Text>
      </View>

      <View style={styles.footer}>
        <Button label={t('authExtra.enableNotifications')} onPress={finish} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  illustration: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.pinkTint,
    opacity: 0.8,
    transform: [{ translateX: 16 }, { translateY: 12 }],
  },
  circle: {
    width: 180,
    height: 180,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleA: { position: 'absolute', top: '20%', left: '20%', fontSize: 22, color: colors.ink },
  sparkleB: { position: 'absolute', bottom: '24%', right: '20%', fontSize: 16, color: colors.ink },
  copy: { gap: spacing.sm },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.display,
    color: colors.text,
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 22,
  },
  footer: { gap: spacing.sm },
});
