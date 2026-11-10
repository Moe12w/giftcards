import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/lib/auth';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  async function onSubmit() {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = t('common.required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('auth.invalidEmail');
    if (password.length < 8) next.password = t('auth.passwordTooShort');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    setAlreadyRegistered(false);
    try {
      await signUp(email.trim(), password, fullName.trim());
      router.push({
        pathname: '/(auth)/verify-email',
        params: { email: email.trim(), name: fullName.trim() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/already registered|already been registered/i.test(message)) {
        setFormError(t('auth.emailAlreadyRegistered'));
        setAlreadyRegistered(true);
      } else if (/rate limit|too many/i.test(message)) {
        setFormError(t('auth.tooManyAttempts'));
      } else if (/password/i.test(message)) {
        setFormError(t('auth.passwordTooShort'));
      } else {
        setFormError(t('auth.signUpFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Glyph name="justBecause" size={38} />
        <Text style={styles.title}>{t('auth.signUp')}</Text>
        <Text style={styles.subtitle}>{t('auth.welcomeSubtitle')}</Text>
      </View>

      <TextField
        label={t('auth.fullName')}
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        error={errors.fullName}
      />
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

      {formError ? (
        <View style={styles.errorBox}>
          <Text style={styles.formError}>{formError}</Text>
          {alreadyRegistered ? (
            <Link href="/(auth)/login" asChild>
              <Pressable accessibilityRole="link" hitSlop={8}>
                <Text style={styles.link}>{t('auth.signInInstead')}</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>
      ) : null}

      <Button label={t('auth.signUpCta')} onPress={onSubmit} loading={submitting} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.haveAccount')} </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.link}>{t('auth.signIn')}</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.xs, marginTop: spacing.xl, marginBottom: spacing.md },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.display,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
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
});
