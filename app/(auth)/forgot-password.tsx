import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthHero } from '@/src/components/AuthHero';
import { BackButton } from '@/src/components/BackButton';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { LanguageToggle } from '@/src/components/LanguageToggle';
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
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
        <LanguageToggle />
      </View>

      <AuthHero
        eyebrow={t('auth.badgeRecover')}
        title={t('authExtra.forgotTitle')}
        subtitle={t('authExtra.forgotBody')}
        glyph="mail"
        tone="sky"
        align="start"
        plateSize={72}
        titleSize={fontSizes.xxl}
        tilt={false}
      />

      <Card style={styles.form}>
        {sent ? (
          <View style={styles.success}>
            <Glyph name="mail" size={30} />
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
      </Card>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  form: { gap: spacing.md },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
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
