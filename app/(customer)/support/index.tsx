import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { ListRow } from '@/src/components/ListRow';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function SupportScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <FlowHeader
        title={t('support.title')}
        subtitle={t('support.subtitle')}
        onBack={() => router.back()}
      />

      <Card>
        <ListRow
          icon="help"
          tone="teal"
          title={t('support.faq')}
          onPress={() => router.push('/(customer)/support/faq')}
        />
        <ListRow
          icon="mail"
          tone="pink"
          title={t('support.contact')}
          onPress={() => router.push('/(customer)/support/contact')}
        />
        <ListRow
          icon="help"
          tone="lavender"
          title={t('support.chat')}
          onPress={() => router.push('/(customer)/support/chat')}
        />
        <ListRow
          icon="warning"
          tone="gold"
          title={t('support.report')}
          onPress={() => router.push('/(customer)/support/report')}
        />
        <ListRow
          icon="mail"
          tone="teal"
          title={t('support.reportGift')}
          onPress={() => router.push('/(customer)/support/report-gift')}
        />
        <ListRow
          icon="message"
          tone="pink"
          title={t('support.refund')}
          onPress={() => router.push('/(customer)/support/refund')}
        />
        <ListRow
          icon="warning"
          tone="lavender"
          title={t('support.refundStatus')}
          last
          onPress={() => router.push('/(customer)/support/refund-status')}
        />
      </Card>

      <Text style={styles.note}>{t('support.contactBody')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 20 },
});
