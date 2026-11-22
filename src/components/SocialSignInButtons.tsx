// src/components/SocialSignInButtons.tsx
// Apple and Google sign-in buttons. Apple's own button component is used
// because App Store guideline 4.8 and Apple's HIG require its exact styling.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from './Button';
import { useAuth } from '../lib/auth';
import { SocialAuthError, isAppleSignInAvailable } from '../lib/social-auth';
import { radii, spacing, themedStyles } from '../theme';

interface SocialSignInButtonsProps {
  /** Receives a message to show under the form, or null to clear it. */
  onError?: (message: string | null) => void;
}

export function SocialSignInButtons({ onError }: SocialSignInButtonsProps) {
  const { t } = useTranslation();
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [pending, setPending] = useState<'apple' | 'google' | null>(null);

  useEffect(() => {
    let active = true;
    isAppleSignInAvailable().then((available) => {
      if (active) setAppleAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  async function run(provider: 'apple' | 'google') {
    if (pending) return;
    onError?.(null);
    setPending(provider);
    try {
      if (provider === 'apple') await signInWithApple();
      else await signInWithGoogle();
      router.replace('/(customer)/(tabs)');
    } catch (error) {
      // A cancelled sheet is a normal choice, not something to complain about.
      if (error instanceof SocialAuthError) {
        if (error.reason === 'cancelled') return;
        onError?.(
          error.reason === 'unavailable' ? t('auth.socialUnavailable') : t('auth.socialSignInFailed'),
        );
        return;
      }
      onError?.(t('auth.socialSignInFailed'));
    } finally {
      setPending(null);
    }
  }

  return (
    <View style={styles.wrap}>
      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radii.md}
          style={styles.appleButton}
          onPress={() => run('apple')}
        />
      ) : null}
      <Button
        label={t('auth.continueWithGoogle')}
        variant="secondary"
        loading={pending === 'google'}
        loadingLabel={t('auth.signingIn')}
        onPress={() => run('google')}
      />
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { gap: spacing.sm },
  // The native Apple button renders nothing without an explicit size.
  appleButton: { height: 50, alignSelf: 'stretch', width: '100%' },
}));
