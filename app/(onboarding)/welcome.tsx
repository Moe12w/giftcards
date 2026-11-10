import React from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { OnboardingSlide } from '@/src/components/OnboardingSlide';
import { markOnboardingSeen } from '@/src/lib/onboarding';

export default function WelcomeSlide() {
  const { t } = useTranslation();

  async function finish() {
    await markOnboardingSeen();
    router.replace('/(auth)/login');
  }

  return (
    <OnboardingSlide
      icon="gift"
      tone="pink"
      title={t('onboarding.welcome.title')}
      body={t('onboarding.welcome.body')}
      step={0}
      total={4}
      nextLabel={t('onboarding.next')}
      skipLabel={t('onboarding.skip')}
      onNext={() => router.push('/(onboarding)/discover')}
      onSkip={finish}
    />
  );
}
