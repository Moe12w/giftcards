import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Chip } from '@/src/components/Chip';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { getOffer } from '@/src/lib/data';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { formatMoney, toMinorUnits } from '@/src/lib/money';
import type { Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function GiftAmountScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, update } = useGiftDraft();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    let active = true;
    if (!id) {
      setLoading(false);
      return;
    }
    getOffer(id)
      .then((data) => active && setOffer(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <Screen>
        <FlowHeader title={t('gift.amountTitle')} step={1} total={3} onBack={() => router.back()} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  const min = offer?.min_amount_minor ?? 0;
  const max = offer?.max_amount_minor ?? Number.MAX_SAFE_INTEGER;
  const amount = draft.amountMinor;

  function choose(minor: number) {
    update({ amountMinor: minor });
    setCustom('');
    setError(null);
  }

  function onChangeCustom(text: string) {
    setCustom(text);
    if (!text.trim()) return;
    try {
      const minor = toMinorUnits(text);
      update({ amountMinor: minor });
      setError(minor < min || minor > max ? t('offer.invalidAmount') : null);
    } catch {
      setError(t('offer.invalidAmount'));
    }
  }

  function next() {
    if (amount < min || amount > max) {
      setError(t('offer.invalidAmount'));
      return;
    }
    setError(null);
    router.push(`/(customer)/gift/${id}/design`);
  }

  return (
    <Screen>
      <FlowHeader
        title={t('gift.amountTitle')}
        subtitle={t('gift.amountSubtitle')}
        step={1}
        total={3}
        onBack={() => router.back()}
      />

      <View style={styles.presets}>
        {(offer?.preset_amounts_minor ?? []).map((preset) => (
          <Chip
            key={preset}
            label={formatMoney(preset, lang)}
            active={!custom && amount === preset}
            onPress={() => choose(preset)}
          />
        ))}
      </View>

      <TextField
        label={t('gift.customAmount')}
        value={custom}
        onChangeText={onChangeCustom}
        placeholder={t('gift.customAmountPlaceholder')}
        keyboardType="decimal-pad"
        error={error ?? undefined}
        hint={t('offer.minAmount', { amount: formatMoney(min, lang) })}
      />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t('checkout.amount')}</Text>
        <Money minor={Number.isFinite(amount) ? amount : 0} style={styles.total} />
      </View>

      <Button label={t('common.continue')} onPress={next} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  totalLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  total: { fontSize: fontSizes.xl, color: colors.text },
});
