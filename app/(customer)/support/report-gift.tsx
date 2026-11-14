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

export default function ReportGiftScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const [giftId, setGiftId] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <FlowHeader title={t('support.reportGiftTitle')} onBack={() => router.back()} />
      <Text style={styles.body}>{t('support.reportGiftBody')}</Text>

      {submitted ? (
        <Text style={styles.submitted}>{t('support.submitted')}</Text>
      ) : (
        <>
          <TextField label={t('common.search')} value={giftId} onChangeText={setGiftId} placeholder="card-1" />
          <TextField
            label={t('support.message')}
            value={message}
            onChangeText={setMessage}
            multiline
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={t('support.send')}
            onPress={async () => {
              setError(null);
              setSending(true);
              try {
                await createSupportRequest({
                  kind: 'report_gift',
                  subject: t('support.reportGiftTitle'),
                  body: message.trim(),
                  reference: giftId.trim() || null,
                });
                setSubmitted(true);
              } catch {
                setError(t('supportTickets.sendFailed'));
              } finally {
                setSending(false);
              }
            }}
            disabled={!message.trim() || sending}
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
