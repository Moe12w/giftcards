import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { IconTile } from '@/src/components/IconTile';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { offerIcon, offerTitle, offerTone } from '@/src/lib/catalog';
import { getOffer } from '@/src/lib/data';
import { useGiftDraft } from '@/src/lib/gift-draft';
import type { AccentTone, Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

const SERVICE_FEE_MINOR = 0;

export default function CheckoutSummaryScreen() {
  const { t, i18n } = useTranslation();
  const { draft } = useGiftDraft();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [promo, setPromo] = useState('');
  const [promoState, setPromoState] = useState<'idle' | 'applied' | 'invalid'>('idle');

  useEffect(() => {
    let active = true;
    if (!draft.offerId) {
      setLoading(false);
      return;
    }
    getOffer(draft.offerId)
      .then((data) => active && setOffer(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [draft.offerId]);

  if (loading) {
    return (
      <Screen>
        <FlowHeader title={t('checkout.summaryTitle')} onBack={() => router.back()} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (!offer) {
    return (
      <Screen>
        <FlowHeader title={t('checkout.summaryTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="receipt"
          tone="lavender"
        />
      </Screen>
    );
  }

  const tone = offerTone(offer) as AccentTone;
  const total = draft.amountMinor + SERVICE_FEE_MINOR;

  function applyPromo() {
    setPromoState(promo.trim().toUpperCase() === 'GIFT10' ? 'applied' : 'invalid');
  }

  return (
    <Screen>
      <FlowHeader
        title={t('checkout.summaryTitle')}
        subtitle={t('checkout.summarySubtitle')}
        onBack={() => router.back()}
      />

      <Card tone={tone === 'sky' ? 'sky' : tone}>
        <View style={styles.offerRow}>
          <IconTile icon={offerIcon(offer)} size={56} tone={tone === 'sky' ? 'sky' : tone} />
          <View style={styles.offerCopy}>
            <Text style={styles.offerTitle}>{offerTitle(offer, i18n.language)}</Text>
            <Text style={styles.offerVendor}>{offer.vendor?.name ?? ''}</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.lines}>
        <Row label={t('checkout.giftCard')} value={t('checkout.amount')} />
        <Row label={t('checkout.fee')} value="QAR 0.00" />
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('checkout.total')}</Text>
          <Money minor={total} style={styles.totalValue} />
        </View>
      </Card>

      <Card style={styles.promoCard}>
        <TextField
          label={t('checkout.promo')}
          value={promo}
          onChangeText={setPromo}
          placeholder={t('checkout.promoPlaceholder')}
          autoCapitalize="characters"
        />
        <Button label={t('checkout.apply')} variant="secondary" onPress={applyPromo} />
        {promoState === 'applied' ? (
          <Text style={styles.promoOk}>{t('checkout.promoApplied')}</Text>
        ) : promoState === 'invalid' ? (
          <Text style={styles.promoBad}>{t('checkout.promoInvalid')}</Text>
        ) : null}
      </Card>

      <Button
        label={t('common.continue')}
        onPress={() => router.push('/(customer)/checkout/payment')}
      />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offerCopy: { flex: 1, gap: 1 },
  offerTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  offerVendor: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  lines: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  rowValue: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  divider: { height: 1, backgroundColor: colors.borderSoft },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  totalValue: { fontSize: fontSizes.xl, color: colors.text },
  promoCard: { gap: spacing.sm },
  promoOk: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.success },
  promoBad: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.danger },
});
