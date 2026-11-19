import React, { useEffect, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FlowHeader } from '@/src/components/FlowHeader';
import { PosterCard } from '@/src/components/PosterCard';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { OCCASIONS } from '@/src/lib/catalog';
import {
  categoryLabel,
  listAppCategories,
  peekAppCategories,
  type AppCategory,
} from '@/src/lib/data';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function CategoriesScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const [categories, setCategories] = useState<AppCategory[]>(() => peekAppCategories());

  useEffect(() => {
    let active = true;
    listAppCategories()
      .then((rows) => {
        if (active) setCategories(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Two home-style cards per row, sized to the screen like the homepage grid.
  const cardWidth = Math.max(140, (width - spacing.gutter * 2 - spacing.sm) / 2);

  return (
    <Screen>
      <FlowHeader title={t('home.categories')} onBack={() => router.back()} splash />

      <SectionHeader title={t('explore.categories')} />
      <View style={styles.grid}>
        {categories.map((category) => (
          <View key={category.slug} style={styles.item}>
            <PosterCard
              tone={category.tone}
              icon={category.icon}
              iconSize={30}
              title={categoryLabel(
                category,
                i18n.language,
                category.titleKey ? t(category.titleKey) : '',
              )}
              titleNumberOfLines={2}
              width={cardWidth}
              artHeight={86}
              onPress={() => router.push(`/(customer)/category/${category.slug}`)}
            />
          </View>
        ))}
      </View>

      <SectionHeader title={t('explore.occasions')} />
      <View style={styles.grid}>
        {OCCASIONS.map((occasion) => (
          <View key={occasion.slug} style={styles.item}>
            <PosterCard
              tone={occasion.tone}
              icon={occasion.icon}
              iconSize={30}
              title={t(occasion.titleKey)}
              titleNumberOfLines={2}
              width={cardWidth}
              artHeight={86}
              onPress={() => router.push(`/(customer)/collection/${occasion.slug}`)}
            />
          </View>
        ))}
      </View>

      <Text style={styles.note}>{t('explore.browseBusinesses')}</Text>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  item: { width: '48.5%' },
  note: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
}));
