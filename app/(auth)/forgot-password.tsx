import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/src/components/BackButton';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/lib/auth';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function ForgotPasswordScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
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
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (/rate limit|too many/i.test(message)) {
        setError(t('auth.tooManyAttempts'));
      } else {
        setError(t('authExtra.resetFailed'));
      }
    } finally {
      setSubmitting(false);
    }
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
          <Glyph name="mail" size={40} />
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>{t('authExtra.resetSentTitle')}</Text>
            <Text style={styles.successText}>
              {t('authExtra.resetSentBody', { email: email.trim() })}
            </Text>
          </View>
        </View>
      ) : null}

      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (sent) setSent(false);
          setError(null);
        }}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={error ?? undefined}
      />

      <Button
        label={sent ? t('authExtra.resendReset') : t('authExtra.sendReset')}
        onPress={onSubmit}
        loading={submitting}
      />

      {sent ? (
        <Button
          label={t('auth.backToSignIn')}
          variant="secondary"
          onPress={() => router.replace('/(auth)/login')}
        />
      ) : null}
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
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tealTint,
  },
  successCopy: { flex: 1, gap: 2 },
  successTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  successText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 19,
  },
}));
