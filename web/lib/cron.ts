// web/lib/cron.ts
// Shared authentication for the endpoints a scheduler calls.
//
// Both the combined scheduled-work route and the advertising maintenance route
// accept the same secret, so a deployment only has to configure one variable.
import { timingSafeEqual } from 'node:crypto';

/**
 * The secret a caller has to present.
 *
 * `ADVERTISING_MAINTENANCE_SECRET` is kept first so existing schedulers that
 * already send it keep working. Vercel Cron sends `CRON_SECRET` on its own.
 */
export function cronSecret(): string | null {
  return process.env.ADVERTISING_MAINTENANCE_SECRET ?? process.env.CRON_SECRET ?? null;
}

/** Reads the secret from `Authorization: Bearer …` or `x-cron-secret`. */
export function cronSecretFromRequest(request: Request): string {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  return bearer || request.headers.get('x-cron-secret') || '';
}

/** Compares without leaking the length or the timing of the match. */
export function cronSecretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
