import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function ReportGiftScreen() {
  const { t } = useTranslation();
  const [giftId, setGiftId] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

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
          <Button
            label={t('support.send')}
            onPress={() => setSubmitted(true)}
            disabled={!message.trim()}
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
