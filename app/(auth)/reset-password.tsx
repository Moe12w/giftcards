import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/src/components/BackButton';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/lib/auth';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { session, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // The screen is opened from the link in the recovery email. Without that
  // session there is nothing to update, so we explain what to do instead of
  // failing with a generic error.
  const hasRecoverySession = Boolean(session);

  async function onSubmit() {
    const next: Record<string, string> = {};
    if (password.length < 8) next.password = t('auth.passwordTooShort');
    if (password !== confirm) next.confirm = t('authExtra.passwordsDontMatch');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch {
      setErrors({ password: t('authExtra.resetFailed') });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <View style={styles.center}>
          <Glyph name="check" size={40} />
          <Text style={styles.title}>{t('authExtra.passwordUpdated')}</Text>
          <Text style={styles.body}>{t('authExtra.passwordUpdatedBody')}</Text>
          <Button label={t('auth.signIn')} onPress={() => router.replace('/(auth)/login')} />
        </View>
      </Screen>
    );
  }

  if (!hasRecoverySession) {
    return (
      <Screen>
        <View style={styles.center}>
          <Glyph name="mail" size={40} />
          <Text style={styles.title}>{t('authExtra.resetLinkNeededTitle')}</Text>
          <Text style={styles.body}>{t('authExtra.resetLinkNeededBody')}</Text>
          <Button
            label={t('authExtra.sendReset')}
            onPress={() => router.replace('/(auth)/forgot-password')}
          />
          <Button
            label={t('auth.backToSignIn')}
            variant="secondary"
            onPress={() => router.replace('/(auth)/login')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>{t('authExtra.resetTitle')}</Text>
      </View>
      <Text style={styles.body}>{t('authExtra.resetBody')}</Text>

      <TextField
        label={t('authExtra.newPassword')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder={t('auth.passwordPlaceholder')}
        error={errors.password}
      />
      <TextField
        label={t('authExtra.confirmPassword')}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        error={errors.confirm}
      />
      <Button label={t('authExtra.resetCta')} onPress={onSubmit} loading={submitting} />
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tealTint,
  },
});
