import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/src/components/BackButton';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit() {
    const next: Record<string, string> = {};
    if (password.length < 8) next.password = t('auth.passwordTooShort');
    if (password !== confirm) next.confirm = t('authExtra.passwordsDontMatch');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setDone(true);
    }, 600);
  }

  if (done) {
    return (
      <Screen>
        <View style={styles.center}>
          <Glyph name="check" size={40} />
          <Text style={styles.title}>{t('authExtra.passwordUpdated')}</Text>
          <Button label={t('auth.signIn')} onPress={() => router.replace('/(auth)/login')} />
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
});
