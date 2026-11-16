import { useThemeRefresh } from '@/src/lib/theme';
import React from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { ListRow } from '@/src/components/ListRow';
import { Screen } from '@/src/components/Screen';
import { getLegalBundle } from '@/src/legal';
import { colors, fontSizes, spacing, themedStyles } from '@/src/theme';

/** Admin area placeholder — built after the customer app. */
export default function AdminHome() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const legal = getLegalBundle(i18n.language === 'ar' ? 'ar' : 'en').ui;

  return (
    <Screen>
      <Text style={styles.title}>{t('admin.title')}</Text>
      <EmptyState title={t('admin.vendors')} body={t('common.loading')} icon="shield" />

      <Card>
        <ListRow
          icon="file"
          tone="teal"
          title={legal.legalCentre}
          subtitle={legal.legalCentreLede}
          onPress={() => router.push('/(customer)/info/legal')}
        />
        <ListRow
          icon="file"
          tone="lavender"
          title={legal.terms}
          onPress={() => router.push('/(customer)/info/terms')}
        />
        <ListRow
          icon="file"
          tone="gold"
          title={legal.privacy}
          last
          onPress={() => router.push('/(customer)/info/privacy')}
        />
      </Card>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  title: { fontSize: fontSizes.display, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
}));
