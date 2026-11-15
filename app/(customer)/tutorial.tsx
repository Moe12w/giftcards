import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { OnboardingSlide } from '@/src/components/OnboardingSlide';
import { CUSTOMER_TUTORIAL, markTutorialSeen, type TutorialLanguage } from '@/src/lib/tutorial';

/**
 * The customer walkthrough. It reuses the onboarding slide so the tour feels
 * native to the app, and it can be replayed from Profile at any time.
 */
export default function TutorialScreen() {
  const { t, i18n } = useTranslation();
  const [index, setIndex] = useState(0);

  const language: TutorialLanguage = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const step = CUSTOMER_TUTORIAL[index];
  const isLast = index === CUSTOMER_TUTORIAL.length - 1;

  // Leaving by the system back gesture should also count as seen, otherwise the
  // tour would auto-open again on the next visit to the home screen.
  useEffect(
    () => () => {
      void markTutorialSeen();
    },
    [],
  );

  async function finish() {
    await markTutorialSeen();
    if (router.canGoBack()) router.back();
    else router.replace('/(customer)/(tabs)');
  }

  function next() {
    if (isLast) {
      finish();
      return;
    }
    setIndex((current) => current + 1);
  }

  return (
    <OnboardingSlide
      icon={step.icon}
      tone={step.tone}
      title={step.title[language]}
      body={step.body[language]}
      tip={step.tip?.[language]}
      step={index}
      total={CUSTOMER_TUTORIAL.length}
      nextLabel={isLast ? t('tutorial.done') : t('tutorial.next')}
      skipLabel={t('tutorial.skip')}
      scroll
      onNext={next}
      onSkip={finish}
      onBack={index > 0 ? () => setIndex((current) => Math.max(0, current - 1)) : undefined}
      backLabel={t('tutorial.back')}
    />
  );
}
