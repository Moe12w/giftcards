import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthHero } from '@/src/components/AuthHero';
import { Avatar } from '@/src/components/Avatar';
import { BackButton } from '@/src/components/BackButton';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { LanguageToggle } from '@/src/components/LanguageToggle';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/lib/auth';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

const AVATAR_TONES = ['teal', 'pink', 'lavender', 'gold'] as const;

export default function ProfileSetupScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { name = '', email = '', phone: initialPhone = '' } = useLocalSearchParams<{
    name?: string;
    email?: string;
    phone?: string;
  }>();
  const { updateProfile } = useAuth();
  const [fullName, setFullName] = useState(name);
  const [phone, setPhone] = useState(initialPhone);
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
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
        <LanguageToggle />
      </View>

      <AuthHero
        eyebrow={t('auth.badgeProfile')}
        title={t('authExtra.profileSetupTitle')}
        subtitle={t('authExtra.profileSetupBody')}
        glyph="user"
        tone="lavender"
        align="start"
        plateSize={72}
        titleSize={fontSizes.xxl}
        tilt={false}
      />

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
              <Avatar name={fullName || email || 'Tazilla'} size={54} tone={avatarTone} />
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.avatarLabel}>{t('authExtra.chooseAvatar')}</Text>

      <Card style={styles.form}>
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
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  avatarWrap: {
    padding: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarActive: { borderColor: colors.border, backgroundColor: colors.tealTint },
  avatarLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  form: { gap: spacing.md },
}));
