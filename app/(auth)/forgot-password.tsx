import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/src/components/BackButton';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setError(null);
    setSubmitting(true);
    // In production this calls Supabase Auth resetPasswordForEmail.
    setTimeout(() => {
      setSubmitting(false);
      setSent(true);
    }, 600);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>{t('authExtra.forgotTitle')}</Text>
      </View>
      <Text style={styles.body}>{t('authExtra.forgotBody')}</Text>

      {sent ? (
        <View style={styles.success}>
          <Text style={styles.successIcon}>📬</Text>
          <Text style={styles.successText}>{t('authExtra.resetSent')}</Text>
        </View>
      ) : null}

      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        error={error ?? undefined}
      />

      <Button
        label={t('authExtra.sendReset')}
        onPress={onSubmit}
        loading={submitting}
      />
      {sent ? (
        <Button
          label={t('authExtra.resetTitle')}
          variant="secondary"
          onPress={() => router.push('/(auth)/reset-password')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tealTint,
  },
  successIcon: { fontSize: 24 },
  successText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
});
