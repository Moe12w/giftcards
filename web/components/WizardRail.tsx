import Link from 'next/link';
import { Check } from 'lucide-react';

export interface WizardStep {
  key: string;
  label: string;
  /** Omit to keep the step non-clickable (e.g. the final confirmation screen). */
  href?: string;
}

/**
 * Shared progress rail for the onboarding and payment wizards. Steps before the
 * current one are complete, the current one is highlighted, and later steps stay
 * reachable when a href is provided so a merchant can jump back and fix things.
 */
export function WizardRail({
  steps,
  current,
  tone = 'mint',
}: {
  steps: WizardStep[];
  current: string;
  tone?: 'mint' | 'lavender' | 'coral';
}) {
  const index = Math.max(
    0,
    steps.findIndex((step) => step.key === current),
  );

  return (
    <ol
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        listStyle: 'none',
        margin: '0 0 20px',
        padding: 0,
      }}
    >
      {steps.map((step, position) => {
        const state = position < index ? 'done' : position === index ? 'current' : 'todo';
        const badge = (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background:
                state === 'todo' ? 'var(--surface)' : `var(--${tone})`,
              color: state === 'todo' ? 'var(--muted)' : '#fff',
            }}
          >
            {state === 'done' ? <Check size={13} /> : position + 1}
          </span>
        );

        const label = (
          <span
            style={{
              fontSize: 13,
              fontWeight: state === 'current' ? 700 : 500,
              color: state === 'todo' ? 'var(--muted)' : 'var(--ink)',
            }}
          >
            {step.label}
          </span>
        );

        const shell = {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 999,
          border: `1px solid ${state === 'current' ? `var(--${tone})` : 'var(--line)'}`,
          background: state === 'current' ? `var(--${tone}-soft)` : 'transparent',
          textDecoration: 'none',
        } as const;

        return (
          <li key={step.key}>
            {step.href ? (
              <Link href={step.href} style={shell} aria-current={state === 'current' ? 'step' : undefined}>
                {badge}
                {label}
              </Link>
            ) : (
              <span style={shell} aria-current={state === 'current' ? 'step' : undefined}>
                {badge}
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
