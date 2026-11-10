import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function RefundStatusScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <FlowHeader title={t('support.refundStatusTitle')} onBack={() => router.back()} />
      <Card tone="teal">
        <Text style={styles.body}>{t('support.refundStatusBody')}</Text>
      </Card>
      <EmptyState
        title={t('support.refundStatusTitle')}
        body={t('support.refundStatusBody')}
        icon="chart"
        tone="lavender"
      />
      <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.text, lineHeight: 21 },
});
