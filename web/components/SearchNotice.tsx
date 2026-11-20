'use client';

import { useSearchParams } from 'next/navigation';

/**
 * The `?sent=1` / `?error=…` banner next to a public form. Reading the query
 * string on the client keeps the page itself prerenderable — a Server Component
 * that awaits `searchParams` would opt the whole page into dynamic rendering.
 */
export function SearchNotice({
  successMessage,
  successParam = 'sent',
}: {
  successMessage: string;
  successParam?: string;
}) {
  const params = useSearchParams();
  const error = params.get('error');
  const success = params.get(successParam) === '1' ? successMessage : null;
  if (!error && !success) return null;

  return (
    <div className={`callout ${error ? 'error' : ''}`} role="status">
      {error ?? success}
    </div>
  );
}
