import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { createSupportRequest } from '@/src/lib/data';
import { useThemeRefresh } from '@/src/lib/theme';
import { TextField } from '@/src/components/TextField';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function RefundScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const [order, setOrder] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={t('support.refund')}
            onPress={async () => {
              setError(null);
              setSending(true);
              try {
                await createSupportRequest({
                  kind: 'refund',
                  subject: reason.trim() || null,
                  body: reason.trim(),
                  reference: order.trim() || null,
                });
                setSubmitted(true);
              } catch {
                setError(t('supportTickets.sendFailed'));
              } finally {
                setSending(false);
              }
            }}
            disabled={!reason.trim() || sending}
          />
        </>
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  body: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.textMuted, lineHeight: 21 },
  input: { minHeight: 120, textAlignVertical: 'top' },
  submitted: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.success, textAlign: 'center', marginTop: spacing.xl },
  error: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.danger, textAlign: 'center' },
}));
