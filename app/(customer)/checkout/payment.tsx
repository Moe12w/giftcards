import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { GiftCardVisual } from '@/src/components/GiftCardVisual';
import { PaymentMethods } from '@/src/components/PaymentMethods';
import { Screen } from '@/src/components/Screen';
import { offerBusinessLogo, offerIcon, offerTitle, offerTone } from '@/src/lib/catalog';
import { useThemeRefresh } from '@/src/lib/theme';
import { getOffer } from '@/src/lib/data';
import { getSupabase } from '@/src/lib/supabase';
import { env } from '@/src/lib/env';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { formatMoney } from '@/src/lib/money';
import { formatDate } from '@/src/lib/time';
import type { Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function PaymentScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { draft } = useGiftDraft();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const idempotencyKey = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    let active = true;
    if (!draft.offerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getOffer(draft.offerId)
      .then((data) => active && setOffer(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [draft.offerId]);

  async function pay() {
    if (paying) return;
    setPaying(true);
    setPayError(null);
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/(auth)/login');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          productId: draft.offerId,
          variantId: draft.variantId ?? null,
          amountMinor: draft.variantId ? undefined : draft.amountMinor,
          recipientName: draft.recipient?.name || user.email || 'Gift recipient',
          recipientEmail: draft.recipient?.email || user.email || '',
          recipientPhone: draft.recipient?.phone || undefined,
          message: draft.message || undefined,
          language: lang,
          idempotencyKey: idempotencyKey.current,
          // MyFatoorah redirects here after payment so the in-app browser
          // closes automatically and we return to the app.
          returnUrl: `${env.appScheme}://payment`,
        },
      });
      if (error) throw error;
      const paymentUrl = String((data as any)?.paymentUrl ?? '');
      const orderId = String((data as any)?.orderId ?? '');
      if (!paymentUrl || !orderId) throw new Error('payment_link_unavailable');

      const redirectUrl = `${env.appScheme}://payment`;
      await WebBrowser.openAuthSessionAsync(paymentUrl, redirectUrl);
      router.push({
        pathname: '/(customer)/checkout/processing',
        params: { orderId },
      });
    } catch (paymentError) {
      console.error('[checkout] payment request failed', paymentError);
      setPayError(
        paymentError instanceof Error && paymentError.message.includes('supplier')
          ? 'This business is not ready to accept payments yet. Please try another gift.'
          : 'We could not start the payment. Please try again.',
      );
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <FlowHeader title={t('checkout.paymentTitle')} onBack={() => router.back()} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (!offer) {
    return (
      <Screen>
        <FlowHeader title={t('checkout.paymentTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="receipt"
          tone="lavender"
        />
        <Button label={t('checkout.backHome')} onPress={() => router.replace('/(customer)/(tabs)')} />
      </Screen>
    );
  }

  const deliveryKey =
    draft.deliveryMethod === 'email'
      ? 'send.deliveryEmail'
      : draft.deliveryMethod === 'sms'
        ? 'send.deliverySms'
        : draft.deliveryMethod === 'whatsapp'
          ? 'send.deliveryWhatsapp'
          : 'send.deliveryLink';

  const selectedVariant =
    offer.variants?.find((variant) => variant.id === draft.variantId) ?? null;

  return (
    <Screen>
      <FlowHeader
        title={t('checkout.paymentTitle')}
        subtitle={t('checkout.paymentSubtitle')}
        onBack={() => router.back()}
      />

      <GiftCardVisual
        compact
        title={offerTitle(offer, i18n.language)}
        icon={offerIcon(offer)}
        logoUrl={offerBusinessLogo(offer)}
        tone={offerTone(offer)}
        amountMinor={selectedVariant ? undefined : draft.amountMinor}
        sessionsTotal={selectedVariant?.session_count ?? undefined}
        sessionsRemaining={selectedVariant?.session_count ?? undefined}
        message={draft.message || undefined}
        meta={
          draft.recipient
            ? `${t('send.recipientTitle')}: ${draft.recipient.name}`
            : undefined
        }
      />

      <Card style={styles.summary}>
        {selectedVariant ? (
          <Row label={t('gift.package')} value={selectedVariant.label} />
        ) : null}
        <Row label={t('checkout.amount')} value={formatMoney(draft.amountMinor, lang)} />
        <Row label={t('send.recipientTitle')} value={draft.recipient?.name ?? '—'} />
        <Row label={t('send.deliveryTitle')} value={t(deliveryKey)} />
        <Row
          label={t('send.deliveryDate')}
          value={
            draft.deliveryDate
              ? formatDate(draft.deliveryDate, i18n.language)
              : t('send.deliveryNow')
          }
        />
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('checkout.total')}</Text>
          <Text style={styles.totalValue}>{formatMoney(draft.amountMinor, lang)}</Text>
        </View>
      </Card>

      {payError ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {payError}
        </Text>
      ) : null}
      {paying ? <ActivityIndicator color={colors.teal} style={styles.loader} /> : null}

      <PaymentMethods amountMinor={draft.amountMinor} onPay={pay} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  loader: { marginTop: spacing.xxl },
  errorText: {
    marginTop: spacing.sm,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: 'center',
  },
  summary: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  rowValue: {
    flexShrink: 1,
    maxWidth: '62%',
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.text,
    textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: colors.borderSoft },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  totalValue: { fontFamily: fonts.extrabold, fontSize: fontSizes.xl, color: colors.text },
}));
