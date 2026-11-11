'use client';

import { CircleHelp } from 'lucide-react';
import { useTutorial } from '@/components/TutorialProvider';

const COPY = {
  en: { label: 'How this works', compact: 'Guide' },
  ar: { label: 'كيف تعمل هذه الصفحة', compact: 'الدليل' },
};

/**
 * The small question mark on a page. It opens the walkthrough at the step
 * that explains this screen, so nobody has to read it from the start.
 */
export function HelpButton({
  step,
  compact = false,
}: {
  step?: string;
  compact?: boolean;
}) {
  const { open, locale } = useTutorial();
  const copy = COPY[locale];

  return (
    <button
      type="button"
      className={`btn sm ghost help-btn${compact ? ' compact' : ''}`}
      onClick={() => open(step)}
    >
      <CircleHelp size={15} />
      {compact ? copy.compact : copy.label}
    </button>
  );
}
