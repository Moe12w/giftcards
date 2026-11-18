'use client';

import { useFormStatus } from 'react-dom';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * A submit button that shows its own pending state. `useFormStatus` reads the
 * state of the enclosing <form action={...}>, so no extra state or fetch
 * patching is needed on public/auth pages that do not render NavProgress.
 */
interface SubmitButtonProps {
  label: ReactNode;
  pendingLabel?: ReactNode;
  className?: string;
  arrow?: boolean;
}

export function SubmitButton({
  label,
  pendingLabel,
  className = 'btn primary block',
  arrow = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={`${className}${pending ? ' is-pending' : ''}`}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <span className="btn-pending">
          <span className="button-spinner" aria-hidden="true" />
          {pendingLabel ?? label}
        </span>
      ) : (
        <span className="btn-label">
          {label}
          {arrow ? <ArrowRight size={16} /> : null}
        </span>
      )}
    </button>
  );
}
