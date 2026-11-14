import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { OfferCard } from '@/src/components/OfferCard';
import { Screen } from '@/src/components/Screen';
import { SearchBar } from '@/src/components/SearchBar';
import { SponsoredStrip } from '@/src/components/SponsoredCarousel';
import { listActiveOffers } from '@/src/lib/data';
import { offerBusinessName, offerTitle } from '@/src/lib/catalog';
import type { Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listActiveOffers()
      .then((data) => active && setOffers(data))
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((offer) => {
      const haystack = [
        offer.title,
        offer.title_ar ?? '',
        offerBusinessName(offer),
        offer.category ?? '',
        offer.location ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [offers, query]);

  return (
    <Screen>
      <FlowHeader title={t('common.search')} onBack={() => router.back()} />

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder={t('explore.searchPlaceholder')}
        accessibilityLabel={t('common.search')}
      />

      {/* Sponsored search results */}
      <SponsoredStrip placementKey="search_sponsored_result" variant="gift_card" limit={3} />

      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : results.length === 0 ? (
        <EmptyState
          title={t('explore.noResults')}
          body={t('explore.noResultsBody')}
          icon="search"
          tone="lavender"
        />
      ) : (
        <>
          <Text style={styles.count}>{t('explore.results', { count: results.length })}</Text>
          <View style={styles.list}>
            {results.map((offer, index) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                index={index}
                onPress={() => router.push(`/(customer)/gift/${offer.id}`)}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  count: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.textMuted },
  list: { gap: spacing.sm },
});
