import { useThemeRefresh } from '@/src/lib/theme';
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

const SLUGS = ['terms', 'privacy', 'about', 'version'] as const;

export default function InfoScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const key = SLUGS.includes(slug as (typeof SLUGS)[number]) ? slug : 'about';

  return (
    <Screen>
      <FlowHeader title={t(`info.${key}.title`)} onBack={() => router.back()} />

      <Card tone="lavender">
        <Text style={styles.body}>{t(`info.${key}.body`)}</Text>
      </Card>

      <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
    lineHeight: 22,
  },
}));
