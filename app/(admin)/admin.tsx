import { useThemeRefresh } from '@/src/lib/theme';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/src/components/EmptyState';
import { Screen } from '@/src/components/Screen';
import { colors, fontSizes, spacing, themedStyles } from '@/src/theme';

/** Admin area placeholder — built after the customer app. */
export default function AdminHome() {
  useThemeRefresh();
  const { t } = useTranslation();
  return (
    <Screen>
      <Text style={styles.title}>{t('admin.title')}</Text>
      <EmptyState title={t('admin.vendors')} body={t('common.loading')} icon="shield" />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  title: { fontSize: fontSizes.display, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
}));
