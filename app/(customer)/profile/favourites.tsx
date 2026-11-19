import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { OfferCard } from '@/src/components/OfferCard';
import { Screen } from '@/src/components/Screen';
import { ShowMore, usePaged } from '@/src/components/ShowMore';
import { offerBusinessId } from '@/src/lib/catalog';
import { pushOnce } from '@/src/lib/navigation';
import { useThemeRefresh } from '@/src/lib/theme';
import { listFavourites } from '@/src/lib/data';
import type { Offer } from '@/src/lib/types';
import { colors, spacing, themedStyles } from '@/src/theme';

export default function FavouritesScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const page = usePaged(offers, 6);

  useEffect(() => {
    let active = true;
    listFavourites()
      .then((data) => active && setOffers(data))
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen>
      <FlowHeader title={t('profile.favourites')} onBack={() => router.back()} splash />

      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : offers.length === 0 ? (
        <EmptyState
          title={t('profile.noFavourites')}
          body={t('explore.browseBusinesses')}
          icon="store"
          tone="lavender"
        />
      ) : (
        <View style={styles.list}>
          {page.visible.map((offer, index) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              index={index}
              onPress={() => pushOnce(`/(customer)/business/${offerBusinessId(offer)}`)}
            />
          ))}
        </View>
      )}
      {page.hasMore ? <ShowMore expanded={page.expanded} onPress={page.toggle} /> : null}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  loader: { marginTop: spacing.xxl },
  list: { gap: spacing.sm },
}));
