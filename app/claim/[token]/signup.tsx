import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/lib/auth';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function ClaimSignupScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('common.required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('auth.invalidEmail');
    if (password.length < 8) next.password = t('auth.passwordTooShort');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await signUp(email.trim(), password, name.trim());
      router.replace(`/claim/${token}/success`);
    } catch {
      setErrors({ form: t('common.errorGeneric') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Glyph name="gift" size={38} />
        <Text style={styles.title}>{t('claimExtra.recipientSignupTitle')}</Text>
        <Text style={styles.body}>{t('claimExtra.recipientSignupBody')}</Text>
      </View>

      <TextField
        label={t('auth.fullName')}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        error={errors.name}
      />
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        error={errors.password}
      />
      {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

      <Button label={t('claimExtra.createAccount')} onPress={submit} loading={submitting} />
      <Button
        label={t('claimExtra.signIn')}
        variant="ghost"
        onPress={() => router.replace(`/claim/${token}/login`)}
      />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  hero: { gap: spacing.xs, marginTop: spacing.xl, marginBottom: spacing.sm },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.display,
    color: colors.text,
    letterSpacing: -0.4,
  },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.textMuted, lineHeight: 21 },
  formError: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.danger },
}));
