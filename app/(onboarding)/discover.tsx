import React from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { OnboardingSlide } from '@/src/components/OnboardingSlide';
import { markOnboardingSeen } from '@/src/lib/onboarding';

export default function DiscoverSlide() {
  const { t } = useTranslation();

  async function finish() {
    await markOnboardingSeen();
    router.replace('/(auth)/login');
  }

  return (
    <OnboardingSlide
      emoji="🧭"
      tone="teal"
      title={t('onboarding.discover.title')}
      body={t('onboarding.discover.body')}
      step={1}
      total={4}
      nextLabel={t('onboarding.next')}
      skipLabel={t('onboarding.skip')}
      onNext={() => router.push('/(onboarding)/personalize')}
      onSkip={finish}
    />
  );
}
