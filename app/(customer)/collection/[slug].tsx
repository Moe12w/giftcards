import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { OfferCard } from '@/src/components/OfferCard';
import { Screen } from '@/src/components/Screen';
import { SponsoredStrip } from '@/src/components/SponsoredCarousel';
import { offersForCollection } from '@/src/lib/catalog';
import { useThemeRefresh } from '@/src/lib/theme';
import { listActiveOffers } from '@/src/lib/data';
import type { Offer } from '@/src/lib/types';
import { colors, spacing, themedStyles } from '@/src/theme';

export default function CollectionScreen() {
  useThemeRefresh();
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

  const results = slug ? offersForCollection(offers, slug) : [];
  const title = slug ? t(`catalog.collections.${slug}.title`) : t('explore.trending');
  const subtitle = slug ? t(`catalog.collections.${slug}.subtitle`) : undefined;

  return (
    <Screen>
      <FlowHeader title={title} subtitle={subtitle} onBack={() => router.back()} />

      {/* Each collection rents its own carousel. Empty slots simply render nothing. */}
      {slug ? (
        <SponsoredStrip placementKey={`collection_${slug}`} variant="gift_card" limit={8} />
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : results.length === 0 ? (
        <EmptyState
          title={t('explore.noResults')}
          body={t('explore.noResultsBody')}
          icon="gift"
          tone="lavender"
        />
      ) : (
        <>
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

const styles = themedStyles(() => ({
  loader: { marginTop: spacing.xxl },
  list: { gap: spacing.sm },
}));
