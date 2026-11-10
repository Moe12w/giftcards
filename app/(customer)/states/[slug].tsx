import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

const SLUGS = [
  'no-internet',
  'error',
  'not-found',
  'empty-search',
  'empty-wallet',
  'empty-sent',
  'empty-received',
  'loading',
  'maintenance',
  'session-expired',
] as const;

export default function StateScreen() {
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const key = SLUGS.includes(slug as (typeof SLUGS)[number]) ? slug : 'error';

  return (
    <Screen>
      <FlowHeader title={t(`states.${key}.title`)} onBack={() => router.back()} />
      <EmptyState
        title={t(`states.${key}.title`)}
        body={t(`states.${key}.body`)}
        icon={key === 'loading' ? 'clock' : key === 'maintenance' ? 'tools' : 'warning'}
        tone="lavender"
      />
      <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({});
