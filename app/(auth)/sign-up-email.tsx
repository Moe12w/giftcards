import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthCardArt } from '@/src/components/AuthCardArt';
import { AuthStepHeader } from '@/src/components/AuthStepHeader';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { LanguageToggle } from '@/src/components/LanguageToggle';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useSignupDraft } from '@/src/lib/signup-draft';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

/** Step 1: who the customer is and how they sign in. */
export default function SignUpEmailScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const draft = useSignupDraft();
  const [fullName, setFullName] = useState(draft.fullName);
  const [email, setEmail] = useState(draft.email);
  const [password, setPassword] = useState(draft.password);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function next() {
    const nextErrors: Record<string, string> = {};
    if (!fullName.trim()) nextErrors.fullName = t('common.required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = t('auth.invalidEmail');
    if (password.length < 8) nextErrors.password = t('auth.passwordTooShort');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    draft.patch({ fullName: fullName.trim(), email: email.trim(), password });
    router.push('/(auth)/sign-up-phone');
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.language}>
        <LanguageToggle />
      </View>

      <AuthStepHeader
        step={0}
        total={2}
        title={t('authExtra.signupEmailTitle')}
        subtitle={t('authExtra.signupEmailBody')}
        tone="lavender"
      />

      <AuthCardArt size="step" />

      <Card style={styles.form}>
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
        <Button label={t('common.continue')} onPress={next} />
      </Card>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>{t('auth.haveAccount')} </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable accessibilityRole="link" hitSlop={8}>
            <Text style={styles.link}>{t('auth.signIn')}</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  content: { paddingTop: spacing.xs, gap: spacing.sm },
  language: { alignSelf: 'flex-end' },
  form: { gap: spacing.md },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.md,
  },
  footerText: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.textMuted },
  link: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.tealDark },
}));
