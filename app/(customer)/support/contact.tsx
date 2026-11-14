import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { createSupportRequest } from '@/src/lib/data';
import { TextField } from '@/src/components/TextField';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function ContactScreen() {
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <FlowHeader title={t('support.contactTitle')} onBack={() => router.back()} />
      <Text style={styles.body}>{t('support.contactBody')}</Text>

      {submitted ? (
        <Text style={styles.submitted}>{t('support.submitted')}</Text>
      ) : (
        <>
          <TextField label={t('support.subject')} value={subject} onChangeText={setSubject} />
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
                  kind: 'contact',
                  subject: subject.trim() || null,
                  body: message.trim(),
                });
                setSubmitted(true);
              } catch {
                setError(t('supportTickets.sendFailed'));
              } finally {
                setSending(false);
              }
            }}
            disabled={!subject.trim() || !message.trim() || sending}
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
  error: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.danger, textAlign: 'center' },
});
