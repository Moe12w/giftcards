import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/lib/auth';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function LoginScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { signIn, isDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);

  async function onSubmit() {
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('auth.invalidEmail');
    if (password.length < 8) next.password = t('auth.passwordTooShort');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    setNeedsAccount(false);
    try {
      await signIn(email.trim(), password);
      router.replace('/(customer)/(tabs)');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/invalid login credentials/i.test(message)) {
        // Supabase gives the same answer for an unknown address and for a wrong
        // password, so both next steps are offered instead of a dead end.
        setFormError(t('auth.noAccountFound'));
        setNeedsAccount(true);
      } else if (/email not confirmed/i.test(message)) {
        setFormError(t('auth.emailNotConfirmed'));
      } else if (/rate limit|too many/i.test(message)) {
        setFormError(t('auth.tooManyAttempts'));
      } else {
        setFormError(t('auth.signInFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.blob} />
        <View style={styles.logoCircle}>
          <Glyph name="gift" size={46} />
        </View>
        <Text style={styles.title}>{t('auth.welcomeTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.welcomeSubtitle')}</Text>
      </View>

      {isDemo ? (
        <Card tone="teal">
          <Text style={styles.demoText}>{t('auth.demoHint')}</Text>
        </Card>
      ) : null}

      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={errors.email}
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.passwordPlaceholder')}
        secureTextEntry
        error={errors.password}
      />

      <Pressable
        onPress={() => router.push('/(auth)/forgot-password')}
        accessibilityRole="button"
        style={styles.forgot}
      >
        <Text style={styles.link}>{t('auth.forgotPassword')}</Text>
      </Pressable>

      {formError ? (
        <View style={styles.errorBox}>
          <Text style={styles.formError}>{formError}</Text>
          {needsAccount ? (
            <Link href="/(auth)/sign-up" asChild>
              <Pressable accessibilityRole="link" hitSlop={8}>
                <Text style={styles.link}>{t('auth.createAccountCta')}</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>
      ) : null}

      <Button label={t('auth.signInCta')} onPress={onSubmit} loading={submitting} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.noAccount')} </Text>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.link}>{t('auth.signUp')}</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  blob: {
    position: 'absolute',
    top: -10,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.pinkTint,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.display,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  demoText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 19,
  },
  forgot: { alignSelf: 'flex-end', paddingVertical: spacing.xs },
  formError: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.danger,
  },
  errorBox: {
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.pinkTint,
    padding: spacing.sm + 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.tealDark,
  },
}));
