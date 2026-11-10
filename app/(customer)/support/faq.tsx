import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

const FAQS = [
  { q: 'support.faqQ1', a: 'support.faqA1' },
  { q: 'support.faqQ2', a: 'support.faqA2' },
  { q: 'support.faqQ3', a: 'support.faqA3' },
  { q: 'support.faqQ4', a: 'support.faqA4' },
  { q: 'support.faqQ5', a: 'support.faqA5' },
];

export default function FaqScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <FlowHeader title={t('support.faqTitle')} onBack={() => router.back()} />

      <View style={styles.list}>
        {FAQS.map((item, index) => (
          <Card key={index} style={styles.card}>
            <Text style={styles.question}>{t(item.q)}</Text>
            <Text style={styles.answer}>{t(item.a)}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { gap: spacing.xs },
  question: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  answer: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 20 },
});
