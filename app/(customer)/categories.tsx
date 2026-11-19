import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CollectionTile } from '@/src/components/CollectionTile';
import { FlowHeader } from '@/src/components/FlowHeader';
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

  return (
    <Screen>
      <FlowHeader title={t('home.categories')} onBack={() => router.back()} splash />

      <SectionHeader title={t('explore.categories')} />
      <View style={styles.grid}>
        {categories.map((category) => (
          <View key={category.slug} style={styles.item}>
            <CollectionTile
              label={categoryLabel(
                category,
                i18n.language,
                category.titleKey ? t(category.titleKey) : '',
              )}
              icon={category.icon}
              tone={category.tone}
              onPress={() => router.push(`/(customer)/category/${category.slug}`)}
            />
          </View>
        ))}
      </View>

      <SectionHeader title={t('explore.occasions')} />
      <View style={styles.grid}>
        {OCCASIONS.map((occasion) => (
          <View key={occasion.slug} style={styles.item}>
            <CollectionTile
              label={t(occasion.titleKey)}
              icon={occasion.icon}
              tone={occasion.tone}
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
