import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/src/components/Avatar';
import { BackButton } from '@/src/components/BackButton';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/lib/auth';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

const AVATAR_TONES = ['teal', 'pink', 'lavender', 'gold'] as const;

export default function ProfileSetupScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { name = '', email = '' } = useLocalSearchParams<{ name?: string; email?: string }>();
  const { updateProfile } = useAuth();
  const [fullName, setFullName] = useState(name);
  const [phone, setPhone] = useState('');
  const [tone, setTone] = useState<(typeof AVATAR_TONES)[number]>('lavender');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function finish() {
    if (!fullName.trim()) {
      setError(t('common.required'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updateProfile({ full_name: fullName.trim(), phone: phone.trim() || undefined });
      router.push('/(auth)/notifications-permission');
    } catch {
      setError(t('common.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>{t('authExtra.profileSetupTitle')}</Text>
      </View>
      <Text style={styles.body}>{t('authExtra.profileSetupBody')}</Text>

      <View style={styles.avatarRow}>
        {AVATAR_TONES.map((avatarTone) => {
          const active = avatarTone === tone;
          return (
            <Pressable
              key={avatarTone}
              onPress={() => setTone(avatarTone)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.avatarWrap, active && styles.avatarActive]}
            >
              <Avatar name={fullName || email || 'Giftly'} size={62} tone={avatarTone} />
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.avatarLabel}>{t('authExtra.chooseAvatar')}</Text>

      <TextField
        label={t('auth.fullName')}
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        error={error ?? undefined}
      />
      <TextField
        label={t('auth.phone')}
        value={phone}
        onChangeText={setPhone}
        placeholder={t('authExtra.phonePlaceholder')}
        keyboardType="phone-pad"
      />

      <Button label={t('authExtra.finishSetup')} onPress={finish} loading={submitting} />
    </Screen>
  );
}

const styles = themedStyles(() => ({
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
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  avatarWrap: {
    padding: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarActive: { borderColor: colors.ink, backgroundColor: colors.tealTint },
  avatarLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
}));
