import { useThemeRefresh } from '@/src/lib/theme';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';
import { useAuth } from '@/src/lib/auth';
import { claimBasket } from '@/src/lib/claim';
import { useBaskets } from '@/src/lib/baskets';

export default function ClaimBasketScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const { reload } = useBaskets();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading || !user || !token) return;
    let active = true;
    claimBasket(token)
      .then(async (basketId) => {
        if (!active) return;
        if (basketId) {
          await reload();
          router.replace('/(customer)/(tabs)/gifts');
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [authLoading, user, token, attempt, reload]);

  const claiming = !authLoading && !!user && !failed;

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        <View style={styles.blob} />
        <View style={styles.circle}>
          <Glyph name="book" size={38} />
        </View>

        {failed ? (
          <>
            <Text style={styles.title}>{t('claimExtra.claimFailedTitle')}</Text>
            <Text style={styles.body}>{t('claimExtra.claimFailedBody')}</Text>
          </>
        ) : claiming ? (
          <>
            <Text style={styles.title}>{t('claim.claiming')}</Text>
            <ActivityIndicator color={colors.teal} />
          </>
        ) : (
          <>
            <Text style={styles.title}>{t('basket.claimTitle', { defaultValue: 'Claim your gift book' })}</Text>
            <Text style={styles.body}>{t('basket.claimBody', { defaultValue: 'Sign in to receive this gift book and the gift cards inside it.' })}</Text>
          </>
        )}
      </View>

      {failed ? (
        <Card style={styles.footer}>
          <Button
            label={t('common.retry')}
            onPress={() => {
              setFailed(false);
              setAttempt((count) => count + 1);
            }}
          />
          <Button
            label={t('claimExtra.viewGift')}
            variant="secondary"
            onPress={() => router.replace('/(customer)/(tabs)/gifts')}
          />
        </Card>
      ) : null}

      {!user && !authLoading ? (
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
      ) : null}
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