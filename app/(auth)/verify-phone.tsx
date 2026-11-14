import { useThemeRefresh } from '@/src/lib/theme';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/src/components/BackButton';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function VerifyPhoneScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { phone = '+974 5555 0000' } = useLocalSearchParams<{ phone?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function verify() {
    if (code.trim().length !== 6) {
      setError(t('common.required'));
      return;
    }
    setError(null);
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      router.replace('/(customer)/(tabs)');
    }, 500);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>{t('authExtra.verifyPhoneTitle')}</Text>
      </View>
      <Text style={styles.body}>{t('authExtra.verifyPhoneBody', { phone })}</Text>

      <TextField
        label={t('authExtra.code')}
        value={code}
        onChangeText={setCode}
        placeholder={t('authExtra.codePlaceholder')}
        keyboardType="number-pad"
        maxLength={6}
        error={error ?? undefined}
      />
      <Button label={t('authExtra.verify')} onPress={verify} loading={submitting} />
      <Button label={t('authExtra.resend')} variant="ghost" onPress={() => setError(null)} />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  title: {
    flex: 1,
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 21,
  },
}));
