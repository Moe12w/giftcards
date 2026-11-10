import React from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { OnboardingSlide } from '@/src/components/OnboardingSlide';
import { markOnboardingSeen } from '@/src/lib/onboarding';

export default function PersonalizeSlide() {
  const { t } = useTranslation();

  async function finish() {
    await markOnboardingSeen();
    router.replace('/(auth)/login');
  }

  return (
    <OnboardingSlide
      emoji="💌"
      tone="lavender"
      title={t('onboarding.personalize.title')}
      body={t('onboarding.personalize.body')}
      step={2}
      total={4}
      nextLabel={t('onboarding.next')}
      skipLabel={t('onboarding.skip')}
      onNext={() => router.push('/(onboarding)/send')}
      onSkip={finish}
    />
  );
}
