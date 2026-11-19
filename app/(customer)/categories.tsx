import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Globe } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { CategoryShortcut, CuratedCollectionCard } from '@/src/components/DiscoveryCards';
import { Screen } from '@/src/components/Screen';
import { SearchBar } from '@/src/components/SearchBar';
import { SectionHeader } from '@/src/components/SectionHeader';
import { SplashText } from '@/src/components/SplashText';
import { configuredCollections, useAppConfig } from '@/src/lib/app-config';
import { CURATED_COLLECTIONS, OCCASIONS } from '@/src/lib/catalog';
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
  const { config } = useAppConfig();
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

  const collections = useMemo(
    () => configuredCollections(config.collections, CURATED_COLLECTIONS),
    [config.collections],
  );

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.iconButton}
        >
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.greetingWrap}>
          <SplashText fontSize={fontSizes.xxl} style={styles.title}>
            {t('home.categories')}
          </SplashText>
          <Text style={styles.subtitle}>{t('explore.categories')}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(customer)/profile/language')}
          accessibilityRole="button"
          accessibilityLabel={t('profile.language')}
          style={styles.iconButton}
        >
          <Globe size={21} color={colors.ink} />
        </Pressable>
      </View>

      <SearchBar
        value=""
        onChangeText={() => undefined}
        onPress={() => router.push('/(customer)/search')}
        placeholder={t('discovery.searchPlaceholder')}
        accessibilityLabel={t('common.search')}
        style={styles.search}
      />

      {categories.length > 0 ? (
        <>
          <SectionHeader title={t('discovery.featuredCategories')} splash />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hScrollOuter}
            contentContainerStyle={styles.hScroll}
          >
            {categories.map((category) => (
              <CategoryShortcut
                key={category.slug}
                label={categoryLabel(
                  category,
                  i18n.language,
                  category.titleKey ? t(category.titleKey) : '',
                )}
                icon={category.icon}
                tone={category.tone}
                onPress={() => router.push(`/(customer)/category/${category.slug}`)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {collections.length > 0 ? (
        <>
          <SectionHeader title={t('discovery.featuredCollections')} splash />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hScrollOuter}
            contentContainerStyle={styles.hScroll}
          >
            {collections.map((collection) => (
              <CuratedCollectionCard
                key={collection.slug}
                label={t(collection.titleKey)}
                subtitle={t(collection.subtitleKey)}
                icon={collection.icon}
                tone={collection.tone}
                onPress={() => router.push(`/(customer)/collection/${collection.slug}`)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <SectionHeader title={t('explore.occasions')} splash />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hScrollOuter}
        contentContainerStyle={styles.hScroll}
      >
        {OCCASIONS.map((occasion) => (
          <CategoryShortcut
            key={occasion.slug}
            label={t(occasion.titleKey)}
            icon={occasion.icon}
            tone={occasion.tone}
            onPress={() => router.push(`/(customer)/collection/${occasion.slug}`)}
          />
        ))}
      </ScrollView>

      <Text style={styles.note}>{t('explore.browseBusinesses')}</Text>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { padding: spacing.xs },
  greetingWrap: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.extrabold, color: colors.text },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  search: { marginTop: spacing.xs },
  hScrollOuter: { marginHorizontal: -spacing.gutter },
  hScroll: { gap: spacing.sm, paddingHorizontal: spacing.gutter },
  note: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
}));
