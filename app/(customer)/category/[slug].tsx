import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { OfferCard } from '@/src/components/OfferCard';
import { Screen } from '@/src/components/Screen';
import { CATEGORIES, offersForCategory } from '@/src/lib/catalog';
import { listActiveOffers } from '@/src/lib/data';
import type { CategoryId, Offer } from '@/src/lib/types';
import { colors, spacing } from '@/src/theme';

export default function CategoryScreen() {
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
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

  const entry = CATEGORIES.find((category) => category.slug === slug);
  const results = slug ? offersForCategory(offers, slug as CategoryId) : [];

  return (
    <Screen>
      <FlowHeader
        title={entry ? t(entry.titleKey) : t('explore.categories')}
        onBack={() => router.back()}
      />

      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : results.length === 0 ? (
        <EmptyState
          title={t('explore.noResults')}
          body={t('explore.noResultsBody')}
          icon={entry?.icon ?? 'gift'}
          tone="teal"
        />
      ) : (
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
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  list: { gap: spacing.sm },
});
