import { useThemeRefresh } from '@/src/lib/theme';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';
import { useAuth } from '@/src/lib/auth';
import { claimGift } from '@/src/lib/claim';

export default function ClaimAddScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || !token) return;
    // Already signed in: bind the gift and continue.
    claimGift(token).finally(() => router.replace(`/claim/${token}/details`));
  }, [authLoading, user, token]);

  if (authLoading) return null;
  if (user) return null;

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        <View style={styles.blob} />
        <View style={styles.circle}>
          <Glyph name="key" size={38} />
        </View>
        <Text style={styles.title}>{t('claimExtra.addTitle')}</Text>
        <Text style={styles.body}>{t('claimExtra.addBody')}</Text>
      </View>

      <Card style={styles.footer}>
        <Button
          label={t('claimExtra.createAccount')}
          onPress={() => router.push(`/claim/${token}/signup`)}
        />
        <Button
          label={t('claimExtra.signIn')}
          variant="secondary"
          onPress={() => router.push(`/claim/${token}/login`)}
        />
      </Card>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  content: { flex: 1, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  blob: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: colors.lavenderTint,
  },
  circle: {
    width: 150,
    height: 150,
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
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: { gap: spacing.sm },
}));
