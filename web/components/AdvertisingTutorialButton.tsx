'use client';

import { BookOpen } from 'lucide-react';
import { TutorialProvider, useTutorial } from '@/components/TutorialProvider';
import { advertisingTutorialScript } from '@/lib/tutorial';

const CHROME = {
  en: { label: 'How advertising works', hint: 'A short guide to placements, slots, prices and payment' },
  ar: { label: 'كيف يعمل الإعلان', hint: 'دليل قصير للمواضع والأماكن والأسعار والدفع' },
};

function Launch({ locale }: { locale: 'en' | 'ar' }) {
  const { open } = useTutorial();
  const copy = CHROME[locale];
  return (
    <button
      type="button"
      className="btn sm ghost"
      onClick={() => open()}
      title={copy.hint}
      aria-label={copy.label}
    >
      <BookOpen size={15} /> {copy.label}
    </button>
  );
}

/**
 * A second, advertising-only walkthrough. It nests its own TutorialProvider so
 * the dashboard guide and the advertising guide never replace each other: the
 * button opens the advertising script, the sidebar button keeps opening the
 * portal script.
 */
export function AdvertisingTutorialButton({
  portal,
  locale = 'en',
}: {
  portal: 'vendor' | 'enterprise' | 'admin';
  locale?: 'en' | 'ar';
}) {
  return (
    <TutorialProvider script={advertisingTutorialScript(portal)} locale={locale} autoOpen={false}>
      <Launch locale={locale} />
    </TutorialProvider>
  );
}
