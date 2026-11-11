import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { IconTile } from '@/src/components/IconTile';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { listMarketplaceBusinesses } from '@/src/lib/data';
import type { PartnerBusiness } from '@/src/lib/data';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

export default function BusinessesScreen() {
  const { t } = useTranslation();
  const [businesses, setBusinesses] = useState<PartnerBusiness[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMarketplaceBusinesses();
      setBusinesses(data);
    } catch {
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: PartnerBusiness }) => (
    <Card style={styles.card}>
      <View style={styles.row}>
        <IconTile
          icon="gift"
          imageUrl={item.logo_url ?? undefined}
          size={56}
          tone="teal"
        />
        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.meta}>
            {item.gift_count} {item.gift_count === 1 ? t('business.oneGift') : t('business.manyGifts')}
          </Text>
        </View>
        <View style={styles.chevronWrap}>
          <Button label="" style={styles.chevronBtn} onPress={() => router.push(`/(customer)/business/${item.id}`)} />
        </View>
      </View>
    </Card>
  );

  return (
    <Screen>
      <FlowHeader title={t('discovery.allBusinesses')} onBack={() => router.back()} />

      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : businesses.length === 0 ? (
        <EmptyState title={t('home.noOffers')} body={t('home.noOffersBody')} icon="warning" tone="lavender" />
      ) : (
        <FlatList
          data={businesses}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copy: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  chevronWrap: { alignItems: 'center', justifyContent: 'center' },
  chevronBtn: { paddingHorizontal: 8 },
});
