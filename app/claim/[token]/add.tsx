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
import { claimBasket, claimGift, fetchClaimBasket } from '@/src/lib/claim';

export default function ClaimAddScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const [failed, setFailed] = useState(false);
  // Bumping this re-runs the claim effect, so "Try again" retries the same
  // token without leaving the screen.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading || !user || !token) return;
    let active = true;

    // Detect whether this token is for a gift card or a basket, then claim
    // accordingly. A basket token routes to the basket claim screen.
    fetchClaimBasket(token)
      .then((basket) => {
        if (!active) return;
        if (basket) {
          // Basket token — claim it and go to gifts.
          claimBasket(token)
            .then(() => {
              if (!active) return;
              router.replace('/(customer)/(tabs)/gifts');
            })
            .catch(() => {
              if (!active) return;
              setFailed(true);
            });
          return;
        }
        // Not a basket — try claiming as a gift card.
        claimGift(token)
          .then(() => {
            if (!active) return;
            router.replace(`/claim/${token}/details`);
          })
          .catch(() => {
            if (!active) return;
            setFailed(true);
          });
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [authLoading, user, token, attempt]);

  // Signed in and not yet failed: the claim is being attempted right now.
  const claiming = !authLoading && !!user && !failed;

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        <View style={styles.blob} />
        <View style={styles.circle}>
          <Glyph name="key" size={38} />
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
            <Text style={styles.title}>{t('claimExtra.addTitle')}</Text>
            <Text style={styles.body}>{t('claimExtra.addBody')}</Text>
          </>
        )}
      </View>

      {failed ? (
        <Card style={styles.footer}>
          <Button
            label={t('common.retry')}
            onPress={() => {
              // Retrying clears the error card and re-runs the claim effect.
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
