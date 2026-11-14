import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { useAuth } from '@/src/lib/auth';
import { useThemeRefresh } from '@/src/lib/theme';
import { TextField } from '@/src/components/TextField';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function SecurityScreen() {
  useThemeRefresh();
  const { updatePassword } = useAuth();
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [twoFactor, setTwoFactor] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  async function save() {
    const nextErrors: Record<string, string> = {};
    if (!current) nextErrors.current = t('common.required');
    if (next.length < 8) nextErrors.next = t('auth.passwordTooShort');
    if (next !== confirm) nextErrors.confirm = t('authExtra.passwordsDontMatch');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await updatePassword(next);
      setSaved(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch {
      setErrors({ next: t('authExtra.resetFailed') });
    }
  }

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
          <Switch
            value={twoFactor}
            onValueChange={setTwoFactor}
            trackColor={{ false: colors.borderSoft, true: colors.teal }}
            thumbColor={colors.surface}
          />
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
}));
