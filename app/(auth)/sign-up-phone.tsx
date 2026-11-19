import React, { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthCardArt } from '@/src/components/AuthCardArt';
import { AuthStepHeader } from '@/src/components/AuthStepHeader';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/lib/auth';
import { useSignupDraft } from '@/src/lib/signup-draft';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fontSizes, spacing, themedStyles } from '@/src/theme';

/** Step 2: contact number, then the account is actually created. */
export default function SignUpPhoneScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { signUp, updateProfile } = useAuth();
  const draft = useSignupDraft();
  const [phone, setPhone] = useState(draft.phone);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  async function finish() {
    setError(null);
    setAlreadyRegistered(false);
    draft.patch({ phone: phone.trim() });

    setSubmitting(true);
    try {
      const { session } = await signUp(draft.email, draft.password, draft.fullName);
      if (session) {
        // Auto-confirmed projects are signed in straight away, so the profile
        // patch can be applied before the final permission screen.
        if (phone.trim()) await updateProfile({ phone: phone.trim() });
        draft.clear();
        router.replace('/(auth)/notifications-permission');
        return;
      }
      // Email confirmation is still pending. Carry the non-secret answers
      // forward; the profile screen saves the phone once the user is signed in.
      router.push({
        pathname: '/(auth)/verify-email',
        params: { email: draft.email, name: draft.fullName, phone: phone.trim() },
      });
      draft.clear();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (/already registered|already been registered/i.test(message)) {
        setError(t('auth.emailAlreadyRegistered'));
        setAlreadyRegistered(true);
      } else if (/rate limit|too many/i.test(message)) {
        setError(t('auth.tooManyAttempts'));
      } else if (/password/i.test(message)) {
        setError(t('auth.passwordTooShort'));
      } else {
        setError(t('auth.signUpFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <AuthStepHeader
        step={1}
        total={2}
        title={t('authExtra.signupPhoneTitle')}
        subtitle={t('authExtra.signupPhoneBody')}
        tone="gold"
      />

      <AuthCardArt size="step" />

      <Card style={styles.form}>
        <TextField
          label={t('auth.phone')}
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            setError(null);
          }}
          placeholder={t('authExtra.phonePlaceholder')}
          keyboardType="phone-pad"
          autoComplete="tel"
          error={error ?? undefined}
        />
        {alreadyRegistered ? (
          <Text style={styles.hint}>{t('auth.signInInstead')}</Text>
        ) : null}
        <Button
          label={t('common.continue')}
          loadingLabel={t('auth.creatingAccount')}
          onPress={finish}
          loading={submitting}
        />
        <Button label={t('authExtra.maybeLater')} variant="ghost" onPress={finish} disabled={submitting} />
      </Card>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  content: { paddingTop: spacing.xs, gap: spacing.sm },
  form: { gap: spacing.md },
  hint: { fontSize: fontSizes.sm, color: colors.tealDark },
}));
