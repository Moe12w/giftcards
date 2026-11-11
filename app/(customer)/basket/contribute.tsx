import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { IconTile, type IconTileTone } from '@/src/components/IconTile';
import { Money } from '@/src/components/Money';
import { PaymentMethods } from '@/src/components/PaymentMethods';
import { Screen } from '@/src/components/Screen';
import { useBaskets } from '@/src/lib/baskets';
import { offerTitle, offerTone } from '@/src/lib/catalog';
import { getOffer } from '@/src/lib/data';
import { formatMoney } from '@/src/lib/money';
import type { AccentTone, Offer, OccasionId } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

interface PendingItem {
  offerId: string;
  amountMinor: number;
}

function parsePending(raw: string | undefined): PendingItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as PendingItem).offerId === 'string' &&
        Number.isInteger((item as PendingItem).amountMinor),
    );
  } catch {
    return [];
  }
}

export default function ContributeScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{
    basketId?: string;
    new?: string;
    name?: string;
    recipient?: string;
    occasion?: string;
    target?: string;
    items?: string;
  }>();
  const { ready, getBasket, addItem, createBasket } = useBaskets();

  const pending = useMemo(() => parsePending(params.items), [params.items]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const isNew = params.new === '1';
  const basket = params.basketId ? getBasket(params.basketId) : null;
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    let active = true;
    Promise.all(pending.map((item) => getOffer(item.offerId)))
      .then((list) => active && setOffers(list.filter((offer): offer is Offer => Boolean(offer))))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [pending]);

  const items = useMemo(
    () =>
      pending
        .map((entry) => {
          const offer = offers.find((candidate) => candidate.id === entry.offerId);
          return offer ? { offer, amountMinor: entry.amountMinor } : null;
        })
        .filter((entry): entry is { offer: Offer; amountMinor: number } => Boolean(entry)),
    [offers, pending],
  );

  const total = items.reduce((sum, item) => sum + item.amountMinor, 0);

  // Open the finished basket as a fresh screen on top of the tabs. Dropping the
  // create → pick → pay screens first means Back from the basket leaves the
  // checkout flow instead of stepping into the payment screen again.
  function openBasket(id: string, query: string) {
    if (router.canDismiss()) {
      router.dismissAll();
      router.push(`/(customer)/basket/${id}?${query}`);
      return;
    }
    router.replace(`/(customer)/basket/${id}?${query}`);
  }

  async function pay() {
    if (paying || items.length === 0) return;
    setPaying(true);
    // In production this waits for the MyFatoorah webhook before the cards are
    // written. Until then the basket is filled straight away.
    if (basket) {
      for (const item of items) {
        await addItem(basket.id, item);
      }
      openBasket(basket.id, 'paid=1');
      return;
    }
    const created = await createBasket({
      name: params.name ?? t('basket.defaultName'),
      recipientName: params.recipient ?? t('basket.yourRecipient'),
      occasion: (params.occasion as OccasionId | undefined) ?? 'birthday',
      targetMinor: Number(params.target ?? 0) || 0,
      items,
    });
    if (!created) {
      setPaying(false);
      return;
    }
    openBasket(created.id, 'paid=1&created=1');
  }

  if (!ready || loading) {
    return (
      <Screen>
        <FlowHeader title={t('basket.contributeTitle')} onBack={() => router.back()} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (!isNew && !basket) {
    return (
      <Screen>
        <FlowHeader title={t('basket.contributeTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="gift"
          tone="lavender"
        />
      </Screen>
    );
  }

  if (basket?.status === 'completed') {
    return (
      <Screen>
        <FlowHeader title={t('basket.contributeTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('basket.completedTitle')}
          body={t('basket.completedBody')}
          icon="congratulations"
          tone="gold"
        />
        <Button label={t('basket.backToBaskets')} onPress={() => router.back()} />
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen>
        <FlowHeader title={t('basket.contributeTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('basket.noItemsTitle')}
          body={t('basket.noItemsBody')}
          icon="gift"
          tone="lavender"
        />
        <Button label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlowHeader
        title={isNew ? t('basket.contributeNewTitle') : t('basket.contributeTitle')}
        subtitle={isNew ? t('basket.contributeNewSubtitle') : t('basket.contributeSubtitle')}
        step={isNew ? 2 : undefined}
        total={isNew ? 3 : undefined}
        onBack={() => router.back()}
      />

      <Card tone="lavender" style={styles.context}>
        <Text style={styles.contextLabel}>
          {isNew ? t('basket.contributeNewContext') : t('basket.contributeContext')}
        </Text>
        <Text style={styles.contextName} numberOfLines={1}>
          {basket?.name ?? params.name ?? t('basket.defaultName')}
        </Text>
        <Text style={styles.contextMeta} numberOfLines={1}>
          {t('basket.forRecipient', {
            name: basket?.recipient_name ?? params.recipient ?? t('basket.yourRecipient'),
          })}
        </Text>
      </Card>

      <Card style={styles.listCard}>
        <Text style={styles.sectionTitle}>{t('basket.contributeItems')}</Text>
        {items.map(({ offer, amountMinor }) => (
          <View key={offer.id} style={styles.itemRow}>
            <IconTile
              icon={offer.icon}
              imageUrl={offer.vendor?.logo_url}
              size={42}
              tone={(offerTone(offer) as AccentTone) as IconTileTone}
            />
            <View style={styles.itemCopy}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {offerTitle(offer, i18n.language)}
              </Text>
              <Text style={styles.itemVendor} numberOfLines={1}>
                {offer.vendor?.name ?? offer.title}
              </Text>
            </View>
            <Money minor={amountMinor} style={styles.itemAmount} />
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('basket.paymentTotal')}</Text>
          <Text style={styles.totalValue}>{formatMoney(total, lang)}</Text>
        </View>
      </Card>

      <Card tone="teal" style={styles.info}>
        <View style={styles.infoIcon}>
          <Lock size={18} color={colors.ink} />
        </View>
        <Text style={styles.infoText}>{t('basket.contributeInfo')}</Text>
      </Card>

      <PaymentMethods
        amountMinor={total}
        onPay={pay}
        paying={paying}
        payLabel={
          isNew
            ? t('basket.contributeNewCta', { amount: formatMoney(total, lang) })
            : t('basket.contributeCta', { amount: formatMoney(total, lang) })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  context: { gap: 1 },
  contextLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  contextName: { fontFamily: fonts.extrabold, fontSize: fontSizes.lg, color: colors.text },
  contextMeta: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  listCard: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemCopy: { flex: 1, gap: 1 },
  itemTitle: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  itemVendor: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  itemAmount: { fontSize: fontSizes.md, color: colors.text },
  divider: { height: 1, backgroundColor: colors.borderSoft },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  totalValue: { fontFamily: fonts.extrabold, fontSize: fontSizes.xl, color: colors.text },
  info: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 18,
  },
});
