import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Plus, Star, Trash2 } from 'lucide-react-native';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { IconTile, type IconTileTone } from '@/src/components/IconTile';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { SearchBar } from '@/src/components/SearchBar';
import { CATEGORIES, offerBusinessLogo, offerBusinessName, offerIsFixedAmount, offerPackages, offerStartingPriceMinor, offerTitle, offerTone } from '@/src/lib/catalog';
import { useThemeRefresh } from '@/src/lib/theme';
import { listActiveOffers } from '@/src/lib/data';
import { formatMoney } from '@/src/lib/money';
import type { AccentTone, CategoryId, OccasionId, Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

type Selection = Record<string, number>;

export default function PickGiftsScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{
    name?: string;
    recipient?: string;
    occasion?: string;
    target?: string;
    basketId?: string;
    preset?: string;
  }>();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [selection, setSelection] = useState<Selection>({});

  const adding = Boolean(params.basketId);

  useEffect(() => {
    let active = true;
    listActiveOffers()
      .then((data) => active && setOffers(data))
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // A card picked from the basket picker arrives already selected. It is only
  // applied once so the customer can still remove it afterwards.
  const presetApplied = useRef(false);
  useEffect(() => {
    if (presetApplied.current) return;
    if (!params.preset) return;
    const preset = offers.find((offer) => offer.id === params.preset);
    if (!preset) return;
    presetApplied.current = true;
    setSelection({
      [preset.id]: offerStartingPriceMinor(preset),
    });
  }, [offers, params.preset]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return offers.filter((offer) => {
      if (category !== 'all' && offer.category !== category) return false;
      if (!needle) return true;
      return [offer.title, offer.title_ar ?? '', offerBusinessName(offer), offer.location ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [category, offers, query]);

  const selectedOffers = useMemo(
    () => offers.filter((offer) => selection[offer.id] !== undefined),
    [offers, selection],
  );

  const total = useMemo(
    () => Object.values(selection).reduce((sum, amount) => sum + amount, 0),
    [selection],
  );

  function toggle(offer: Offer) {
    setSelection((prev) => {
      if (prev[offer.id] !== undefined) {
        const next = { ...prev };
        delete next[offer.id];
        return next;
      }
      return {
        ...prev,
        [offer.id]: offerStartingPriceMinor(offer),
      };
    });
  }

  function setAmount(offer: Offer, amountMinor: number) {
    setSelection((prev) => ({ ...prev, [offer.id]: amountMinor }));
  }

  function finish() {
    if (selectedOffers.length === 0) return;
    const items = selectedOffers.map((offer) => ({
      offer,
      amountMinor: selection[offer.id],
    }));
    const encodedItems = JSON.stringify(
      items.map((item) => ({ offerId: item.offer.id, amountMinor: item.amountMinor })),
    );

    // Cards are only written to the basket after the contribution payment
    // succeeds, so the box never contains an unpaid gift.
    if (adding && params.basketId) {
      router.push({
        pathname: '/(customer)/basket/contribute',
        params: { basketId: params.basketId, items: encodedItems },
      });
      return;
    }

    router.push({
      pathname: '/(customer)/basket/contribute',
      params: {
        new: '1',
        name: params.name ?? t('basket.defaultName'),
        recipient: params.recipient ?? t('basket.yourRecipient'),
        occasion: (params.occasion as OccasionId | undefined) ?? 'birthday',
        target: params.target ?? '0',
        items: encodedItems,
      },
    });
  }

  const ctaLabel = t('basket.continuePayment', { count: selectedOffers.length });

  return (
    <Screen>
      <FlowHeader
        title={adding ? t('basket.addGift') : t('basket.chooseGifts')}
        subtitle={adding ? t('basket.addGiftSubtitle') : t('basket.chooseGiftsSubtitle')}
        step={adding ? undefined : 1}
        total={adding ? undefined : 3}
        onBack={() => router.back()}
      />

      {!adding && params.name ? (
        <Card tone="lavender" style={styles.context}>
          <View style={styles.contextRow}>
            <View style={styles.contextIcon}>
              <Glyph name="gift" size={30} />
            </View>
            <View style={styles.contextCopy}>
              <Text style={styles.contextName} numberOfLines={1}>
                {params.name}
              </Text>
              <Text style={styles.contextMeta} numberOfLines={1}>
                {t('basket.forRecipient', { name: params.recipient ?? '' })}
              </Text>
            </View>
            <Badge label={t('basket.picking')} tone="primary" />
          </View>
        </Card>
      ) : null}

      {/* Selection summary */}
      <Card tone="teal" style={styles.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryLabel}>{t('basket.selectedCards', { count: selectedOffers.length })}</Text>
            <Money minor={total} style={styles.summaryAmount} />
          </View>
          <View style={styles.summaryIcon}>
            <Glyph name="receipt" size={24} />
          </View>
        </View>
        {selectedOffers.length > 0 ? (
          <View style={styles.selectedList}>
            {selectedOffers.map((offer) => (
              <View key={offer.id} style={styles.selectedRow}>
                <IconTile
                  icon={offer.icon}
                  imageUrl={offerBusinessLogo(offer)}
                  size={34}
                  tone={(offerTone(offer) as AccentTone) as IconTileTone}
                />
                <Text style={styles.selectedTitle} numberOfLines={1}>
                  {offerBusinessName(offer, offerTitle(offer, i18n.language))}
                </Text>
                <Money minor={selection[offer.id]} style={styles.selectedAmount} />
                <Pressable
                  onPress={() => toggle(offer)}
                  accessibilityRole="button"
                  accessibilityLabel={t('basket.remove')}
                  hitSlop={6}
                  style={styles.removeButton}
                >
                  <Trash2 size={14} color={colors.ink} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.summaryHint}>{t('basket.selectionHint')}</Text>
        )}
      </Card>

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder={t('basket.searchPlaceholder')}
        accessibilityLabel={t('common.search')}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <Chip
          label={t('basket.allCategories')}
          active={category === 'all'}
          onPress={() => setCategory('all')}
        />
        {CATEGORIES.map((entry) => (
          <Chip
            key={entry.slug}
            label={t(entry.titleKey)}
            active={category === entry.slug}
            onPress={() => setCategory(entry.slug as CategoryId)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : error ? (
        <Card tone="pink" style={styles.errorCard}>
          <EmptyState
            title={t('states.error.title')}
            body={t('states.error.body')}
            icon="warning"
            tone="pink"
          />
          <Button label={t('common.retry')} onPress={() => router.replace('/(customer)/(tabs)')} />
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('explore.noResults')}
          body={t('explore.noResultsBody')}
          icon="warning"
          tone="lavender"
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((offer) => {
            const selected = selection[offer.id] !== undefined;
            const tone = (offerTone(offer) as AccentTone) as IconTileTone;
            return (
              <Card key={offer.id} tone={selected ? 'gold' : 'surface'} style={styles.offerCard}>
                <View style={styles.offerRow}>
                  <IconTile
                    icon={offer.icon}
                    imageUrl={offerBusinessLogo(offer)}
                    size={56}
                    tone={tone}
                  />
                  <View style={styles.offerCopy}>
                    <Text style={styles.offerTitle} numberOfLines={1}>
                      {offerTitle(offer, i18n.language)}
                    </Text>
                    <Text style={styles.offerVendor} numberOfLines={1}>
                      {offerBusinessName(offer, offer.title)}
                    </Text>
                    <View style={styles.offerMeta}>
                      <Star size={11} color={colors.gold} />
                      <Text style={styles.offerMetaText}>{(offer.rating ?? 4.8).toFixed(1)}</Text>
                      {offer.location ? (
                        <>
                          <Text style={styles.dot}>·</Text>
                          <Text style={styles.offerMetaText}>{offer.location}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => toggle(offer)}
                    accessibilityRole="button"
                    accessibilityLabel={selected ? t('basket.remove') : t('basket.add')}
                    style={({ pressed }) => [
                      styles.addButton,
                      selected && styles.addButtonActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    {selected ? <Check size={18} color={colors.ink} /> : <Plus size={18} color={colors.ink} />}
                  </Pressable>
                </View>

                {selected ? (
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>{t('basket.amount')}</Text>
                    {offerIsFixedAmount(offer) ? (
                      <Money minor={selection[offer.id] ?? offer.min_amount_minor} style={styles.amountFixed} />
                    ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.amountChips}
                    >
                      {offer.fulfilment_type === 'experience'
                        ? offerPackages(offer).map((variant) => (
                            <Chip
                              key={variant.id}
                              label={`${variant.label} · ${formatMoney(
                                variant.price_minor,
                                i18n.language === 'ar' ? 'ar' : 'en',
                              )}`}
                              active={selection[offer.id] === variant.price_minor}
                              onPress={() => setAmount(offer, variant.price_minor)}
                            />
                          ))
                        : offer.preset_amounts_minor.map((amount) => (
                            <Chip
                              key={amount}
                              label={formatMoney(amount, i18n.language === 'ar' ? 'ar' : 'en')}
                              active={selection[offer.id] === amount}
                              onPress={() => setAmount(offer, amount)}
                            />
                          ))}
                    </ScrollView>
                    )}
                  </View>
                ) : (
                  <View style={styles.offerFooter}>
                    <Text style={styles.offerFrom}>{t('common.from')}</Text>
                    <Money minor={offerStartingPriceMinor(offer)} style={styles.offerAmount} />
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      {selectedOffers.length > 0 ? (
        <Card style={styles.bar}>
          <View style={styles.barRow}>
            <View style={styles.barCopy}>
              <Text style={styles.barLabel}>
                {t('basket.selectedCards', { count: selectedOffers.length })}
              </Text>
              <Money minor={total} style={styles.barAmount} />
            </View>
            <Button
              label={ctaLabel}
              fullWidth={false}
              style={styles.barButton}
              onPress={finish}
            />
          </View>
        </Card>
      ) : null}

      {selectedOffers.length > 0 ? (
        <View style={styles.barSpacer} />
      ) : null}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  context: {},
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contextIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextCopy: { flex: 1, gap: 1 },
  contextName: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  contextMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  summary: { gap: spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryCopy: { flex: 1, gap: 1 },
  summaryLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  summaryAmount: { fontSize: fontSizes.xxl, color: colors.text },
  summaryIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  selectedList: { gap: spacing.xs },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  selectedTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  selectedAmount: { fontSize: fontSizes.sm, color: colors.text },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: { gap: spacing.sm, paddingRight: spacing.md },
  loader: { marginVertical: spacing.lg },
  errorCard: { gap: spacing.sm },
  list: { gap: spacing.sm },
  offerCard: { gap: spacing.sm },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offerCopy: { flex: 1, gap: 1 },
  offerTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  offerVendor: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  offerMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  offerMetaText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  dot: { color: colors.textMuted, fontSize: fontSizes.xs },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonActive: { backgroundColor: colors.teal },
  amountRow: { gap: spacing.xs },
  amountLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  amountChips: { gap: spacing.xs, paddingRight: spacing.md },
  amountFixed: { fontSize: fontSizes.md, color: colors.text },
  offerFooter: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  offerFrom: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  offerAmount: { fontSize: fontSizes.md, color: colors.text },
  bar: { marginTop: spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barCopy: { flex: 1, gap: 0 },
  barLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  barAmount: { fontSize: fontSizes.lg, color: colors.text },
  barButton: { paddingHorizontal: spacing.md },
  barSpacer: { height: spacing.sm },
  pressed: { opacity: 0.85, transform: [{ translateY: 2 }] },
}));
