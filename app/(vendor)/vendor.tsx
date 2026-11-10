import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/src/components/EmptyState';
import { Screen } from '@/src/components/Screen';
import { colors, fontSizes, spacing } from '@/src/theme';

/** Vendor area placeholder — built after the customer app. */
export default function VendorHome() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text style={styles.title}>{t('vendor.title')}</Text>
      <EmptyState title={t('vendor.onboarding')} body={t('common.loading')} icon="store" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSizes.display, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
});
