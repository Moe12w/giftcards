import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/lib/auth';
import { hasSupabaseConfig } from '@/src/lib/env';
import { getSupabase } from '@/src/lib/supabase';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function SecurityScreen() {
  useThemeRefresh();
  const { user, updatePassword } = useAuth();
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [twoFactor, setTwoFactor] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Ask the auth server whether the account has two-factor authentication on.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasSupabaseConfig) {
        if (!cancelled) setTwoFactor(false);
        return;
      }
      try {
        const { data, error: mfaError } = await getSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
        if (!cancelled) setTwoFactor(!mfaError && data?.currentLevel === 'aal2');
      } catch {
        if (!cancelled) setTwoFactor(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    const nextErrors: Record<string, string> = {};
    if (!current) nextErrors.current = t('profile.currentPassword');
    if (next.length < 8) nextErrors.next = t('auth.passwordTooShort');
    if (next !== confirm) nextErrors.confirm = t('authExtra.passwordsDontMatch');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // Re-authenticate before changing the password: the current password is
    // checked here, so a stolen session cannot be used to take over the account.
    try {
      const { error: signInError } = await getSupabase().auth.signInWithPassword({
        email: user?.email ?? '',
        password: current,
      });
      if (signInError) {
        setErrors({ current: t('authExtra.currentPasswordIncorrect') });
        return;
      }
      await updatePassword(next);
      setSaved(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch {
      setErrors({ next: t('authExtra.resetFailed') });
    }
  }

  const twoFactorStatus = twoFactor
    ? t('profile.twoFactorEnabled')
    : twoFactor === null
      ? t('common.loading')
      : t('profile.twoFactorPending');

  return (
    <Screen>
      <FlowHeader
        title={t('profile.security')}
        subtitle={t('profile.securityBody')}
        onBack={() => router.back()}
      />

      {saved ? <Text style={styles.saved}>{t('authExtra.passwordUpdated')}</Text> : null}

      <Card style={styles.form}>
        <Text style={styles.sectionTitle}>{t('profile.changePassword')}</Text>
        <TextField
          label={t('profile.currentPassword')}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          error={errors.current}
        />
        <TextField
          label={t('profile.newPassword')}
          value={next}
          onChangeText={setNext}
          secureTextEntry
          error={errors.next}
        />
        <TextField
          label={t('profile.confirmPassword')}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          error={errors.confirm}
        />
        <Button label={t('profile.saveChanges')} onPress={save} />
      </Card>

      <Card>
        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.twoFactor')}</Text>
          <Text style={styles.status}>{twoFactorStatus}</Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  saved: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.success },
  form: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: fontSizes.md, color: colors.text },
  status: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.text, textAlign: 'right' },
}));
