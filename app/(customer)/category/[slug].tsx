import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { giftHref } from '@/src/lib/navigation';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { OfferCard } from '@/src/components/OfferCard';
import { Screen } from '@/src/components/Screen';
import { ShowMore, usePaged } from '@/src/components/ShowMore';
import { SponsoredStrip } from '@/src/components/SponsoredCarousel';
import { offersForCategory } from '@/src/lib/catalog';
import { useThemeRefresh } from '@/src/lib/theme';
import {
  categoryLabel,
  listActiveOffers,
  listAppCategories,
  peekAppCategories,
  type AppCategory,
} from '@/src/lib/data';
import type { CategoryId, Offer } from '@/src/lib/types';
import { colors, spacing, themedStyles } from '@/src/theme';

export default function CategoryScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<AppCategory[]>(() => peekAppCategories());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listActiveOffers()
      .then((data) => active && setOffers(data))
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    listAppCategories()
      .then((rows) => active && setCategories(rows))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const entry = categories.find((category) => category.slug === slug);
  const results = slug ? offersForCategory(offers, slug as CategoryId) : [];
  const page = usePaged(results, 6);

  return (
    <Screen>
      <FlowHeader
        title={entry
          ? categoryLabel(entry, i18n.language, entry.titleKey ? t(entry.titleKey) : '')
          : t('explore.categories')}
        onBack={() => router.back()}
        splash
      />

      {/* Each category rents its own carousel. Empty slots simply render nothing. */}
      {slug ? (
        <SponsoredStrip placementKey={`category_${slug}`} variant="gift_card" limit={8} />
      ) : null}

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
        <>
          <View style={styles.list}>
            {page.visible.map((offer, index) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                index={index}
                onPress={() => router.push(giftHref(offer) as never)}
              />
            ))}
          </View>
          {page.hasMore ? <ShowMore expanded={page.expanded} onPress={page.toggle} /> : null}
        </>
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  loader: { marginTop: spacing.xxl },
  list: { gap: spacing.sm },
}));
