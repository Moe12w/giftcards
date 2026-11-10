import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function RefundScreen() {
  const { t } = useTranslation();
  const [order, setOrder] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <Screen>
      <FlowHeader title={t('support.refundTitle')} onBack={() => router.back()} />
      <Text style={styles.body}>{t('support.refundBody')}</Text>

      {submitted ? (
        <Text style={styles.submitted}>{t('support.submitted')}</Text>
      ) : (
        <>
          <TextField label={t('orders.orderNumber', { number: '' })} value={order} onChangeText={setOrder} />
          <TextField
            label={t('support.message')}
            value={reason}
            onChangeText={setReason}
            multiline
            style={styles.input}
          />
          <Button
            label={t('support.refund')}
            onPress={() => setSubmitted(true)}
            disabled={!reason.trim()}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.textMuted, lineHeight: 21 },
  input: { minHeight: 120, textAlignVertical: 'top' },
  submitted: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.success, textAlign: 'center', marginTop: spacing.xl },
});
