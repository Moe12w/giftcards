import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/lib/auth';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState((user?.user_metadata?.full_name as string | undefined) ?? '');
  const [phone, setPhone] = useState((user?.user_metadata?.phone as string | undefined) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      setError(t('common.required'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ full_name: name.trim(), phone: phone.trim() || undefined });
      setSaved(true);
    } catch {
      setError(t('common.errorGeneric'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <FlowHeader title={t('profile.editProfile')} onBack={() => router.back()} />

      {saved ? <Text style={styles.saved}>{t('profile.profileUpdated')}</Text> : null}

      <TextField
        label={t('auth.fullName')}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        error={error ?? undefined}
      />
      <TextField label={t('auth.email')} value={user?.email ?? ''} editable={false} />
      <TextField
        label={t('auth.phone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder={t('authExtra.phonePlaceholder')}
      />

      <Button label={t('profile.saveChanges')} onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  saved: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.success,
  },
});
