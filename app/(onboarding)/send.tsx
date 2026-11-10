import React from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { OnboardingSlide } from '@/src/components/OnboardingSlide';
import { markOnboardingSeen } from '@/src/lib/onboarding';

export default function SendSlide() {
  const { t } = useTranslation();

  async function finish() {
    await markOnboardingSeen();
    router.replace('/(auth)/login');
  }

  return (
    <OnboardingSlide
      emoji="🚀"
      tone="gold"
      title={t('onboarding.send.title')}
      body={t('onboarding.send.body')}
      step={3}
      total={4}
      nextLabel={t('onboarding.getStarted')}
      skipLabel={t('onboarding.skip')}
      onNext={finish}
      onSkip={finish}
    />
  );
}
