import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CollectionTile } from '@/src/components/CollectionTile';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { CATEGORIES, OCCASIONS } from '@/src/lib/catalog';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function CategoriesScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <FlowHeader title={t('home.categories')} onBack={() => router.back()} />

      <SectionHeader title={t('explore.categories')} />
      <View style={styles.grid}>
        {CATEGORIES.map((category) => (
          <View key={category.slug} style={styles.item}>
            <CollectionTile
              label={t(category.titleKey)}
              emoji={category.emoji}
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
              emoji={occasion.emoji}
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

const styles = StyleSheet.create({
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
});
