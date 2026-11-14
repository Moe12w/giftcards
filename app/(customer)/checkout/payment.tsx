import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
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
import { useGiftDraft } from '@/src/lib/gift-draft';
import { formatMoney } from '@/src/lib/money';
import type { Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function PaymentScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { draft } = useGiftDraft();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);

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

  function pay() {
    router.push({
      pathname: '/(customer)/checkout/processing',
      params: { amount: String(draft.amountMinor) },
    });
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
              ? new Date(draft.deliveryDate).toLocaleDateString(
                  i18n.language === 'ar' ? 'ar-QA' : 'en-QA',
                )
              : t('send.deliveryNow')
          }
        />
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('checkout.total')}</Text>
          <Text style={styles.totalValue}>{formatMoney(draft.amountMinor, lang)}</Text>
        </View>
      </Card>

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
