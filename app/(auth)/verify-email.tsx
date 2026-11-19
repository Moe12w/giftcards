import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
import { getSupabase } from '@/src/lib/supabase';
import { hasSupabaseConfig } from '@/src/lib/env';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

export default function VerifyEmailScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { email = 'you@example.com', name = '', phone = '' } = useLocalSearchParams<{
    email?: string;
    name?: string;
    phone?: string;
  }>();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);

  async function verify() {
    if (code.trim().length !== 6) {
      setError(t('authExtra.codeLength'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (hasSupabaseConfig) {
        const { error: verifyError } = await getSupabase().auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: 'email',
        });
        if (verifyError) throw verifyError;
      }
      router.push({ pathname: '/(auth)/profile-setup', params: { name, email, phone } });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (/expired|expired_token/i.test(message)) {
        setError(t('authExtra.codeExpired'));
      } else if (/invalid|token/i.test(message)) {
        setError(t('authExtra.codeInvalid'));
      } else if (/rate limit|too many/i.test(message)) {
        setError(t('auth.tooManyAttempts'));
      } else {
        setError(t('authExtra.verifyFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setResent(false);
    setError(null);
    if (!hasSupabaseConfig || !user?.email) return;
    try {
      await getSupabase().auth.resend({
        type: 'signup',
        email: user.email,
      });
      setResent(true);
    } catch {
      setError(t('authExtra.resendFailed'));
    }
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
        <LanguageToggle />
      </View>

      <AuthHero
        eyebrow={t('auth.badgeVerify')}
        title={t('authExtra.verifyEmailTitle')}
        subtitle={t('authExtra.verifyEmailBody', { email })}
        glyph="mail"
        tone="gold"
        align="start"
        plateSize={72}
        titleSize={fontSizes.xxl}
        tilt={false}
      />

      <Card style={styles.form}>
        {resent ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{t('authExtra.codeResent')}</Text>
          </View>
        ) : null}

        <TextField
          label={t('authExtra.code')}
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setError(null);
          }}
          placeholder={t('authExtra.codePlaceholder')}
          keyboardType="number-pad"
          maxLength={6}
          error={error ?? undefined}
        />
        <Button label={t('authExtra.verify')} onPress={verify} loading={submitting} />
        <Button label={t('authExtra.resend')} variant="ghost" onPress={resend} />
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
  notice: {
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.tealTint,
    padding: spacing.sm + 2,
  },
  noticeText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
}));
