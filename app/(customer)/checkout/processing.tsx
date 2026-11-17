import { useThemeRefresh } from '@/src/lib/theme';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { getSupabase } from '@/src/lib/supabase';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

/**
 * Waits for the backend to confirm payment. A return URL is never treated as
 * proof of payment: only the `myfatoorah_payment_status` RPC (which reads the
 * webhook-confirmed order) can move the customer to success.
 */
export default function ProcessingScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    if (!orderId) {
      router.replace('/(customer)/checkout/failed');
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + 5 * 60 * 1000;

    const poll = async () => {
      if (stopped.current) return;
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('myfatoorah_payment_status', {
          p_order_id: orderId,
        });
        if (error) throw error;
        const status = data as { paid?: boolean; failed?: boolean } | null;
        if (status?.paid) {
          router.replace('/(customer)/checkout/success');
          return;
        }
        if (status?.failed) {
          router.replace('/(customer)/checkout/failed');
          return;
        }
      } catch (pollError) {
        console.error('[checkout] payment status poll failed', pollError);
      }

      if (Date.now() > deadline) {
        router.replace('/(customer)/checkout/failed');
        return;
      }
      timer = setTimeout(poll, 2500);
    };

    void poll();
    return () => {
      stopped.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        <View style={styles.blob} />
        <View style={styles.circle}>
          <ActivityIndicator color={colors.plum} size="large" />
        </View>
        <Text style={styles.title}>{t('checkout.processingTitle')}</Text>
        <Text style={styles.body}>{t('checkout.processingBody')}</Text>
        <Button
          label={t('checkout.backHome')}
          variant="ghost"
          onPress={() => router.replace('/(customer)/(tabs)')}
        />
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  content: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center', gap: spacing.sm },
  blob: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.tealTint,
    transform: [{ translateY: -6 }],
  },
  circle: {
    width: 140,
    height: 140,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
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
  },
}));
