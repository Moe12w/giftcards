import React, { useState } from 'react';
import { View } from 'react-native';
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
import { fontSizes, spacing, themedStyles } from '@/src/theme';

export default function ResetPasswordScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { recovery, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // The screen is opened from the link in the recovery email. Without that
  // recovery session there is nothing to update, so we explain what to do instead
  // of failing with a generic error. The flag is set only by the password
  // recovery flow, never by an arbitrary deep link.
  const hasRecoverySession = recovery;

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
        <AuthHero
          eyebrow={t('auth.badgeAlmost')}
          title={t('authExtra.passwordUpdated')}
          subtitle={t('authExtra.passwordUpdatedBody')}
          glyph="check"
          tone="teal"
          titleSize={fontSizes.xxl}
        />
        <Button label={t('auth.signIn')} onPress={() => router.replace('/(auth)/login')} />
      </Screen>
    );
  }

  if (!hasRecoverySession) {
    return (
      <Screen>
        <AuthHero
          eyebrow={t('auth.badgeRecover')}
          title={t('authExtra.resetLinkNeededTitle')}
          subtitle={t('authExtra.resetLinkNeededBody')}
          glyph="mail"
          tone="sky"
          titleSize={fontSizes.xxl}
        />
        <Card style={styles.form}>
          <Button
            label={t('authExtra.sendReset')}
            onPress={() => router.replace('/(auth)/forgot-password')}
          />
          <Button
            label={t('auth.backToSignIn')}
            variant="secondary"
            onPress={() => router.replace('/(auth)/login')}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
        <LanguageToggle />
      </View>

      <AuthHero
        eyebrow={t('auth.badgeAlmost')}
        title={t('authExtra.resetTitle')}
        subtitle={t('authExtra.resetBody')}
        glyph="lock"
        tone="lavender"
        align="start"
        plateSize={72}
        titleSize={fontSizes.xxl}
        tilt={false}
      />

      <Card style={styles.form}>
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
}));
