// src/components/GuestGate.tsx
// Shown when a guest reaches an account-only screen. Browsing stays public;
// only wallet, baskets, checkout and personal data require a session.
import React from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from './Button';
import { Card } from './Card';
import { Glyph } from './Glyph';
import { Screen } from './Screen';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

interface GuestGateProps {
  title?: string;
  body?: string;
  /** Keep room for the floating tab bar. */
  tabbed?: boolean;
  /** Nested stack screens have no tab bar, so offer a way back to Explore. */
  showBrowse?: boolean;
}

export function GuestGate({ title, body, tabbed = false, showBrowse = false }: GuestGateProps) {
  const { t } = useTranslation();

  return (
    <Screen tabbed={tabbed} scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        <View style={styles.blob} />
        <View style={styles.circle}>
          <Glyph name="lock" size={38} />
        </View>
        <Text style={styles.title}>{title ?? t('guest.title')}</Text>
        <Text style={styles.body}>{body ?? t('guest.body')}</Text>
      </View>

      <Card style={styles.actions}>
        <Button label={t('guest.signIn')} onPress={() => router.push('/(auth)/login')} />
        <Button
          label={t('guest.createAccount')}
          variant="secondary"
          onPress={() => router.push('/(auth)/sign-up')}
        />
        {showBrowse ? (
          <Button
            label={t('guest.browse')}
            variant="ghost"
            onPress={() => router.replace('/(customer)/(tabs)')}
          />
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  content: { flex: 1, justifyContent: 'space-between', paddingTop: spacing.xl },
  center: { alignItems: 'center', gap: spacing.sm },
  blob: {
    position: 'absolute',
    top: -40,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: colors.lavenderTint,
  },
  circle: {
    width: 132,
    height: 132,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: { gap: spacing.sm },
}));
