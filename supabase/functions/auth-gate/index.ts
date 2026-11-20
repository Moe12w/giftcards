// supabase/functions/auth-gate/index.ts
// Login gate for the mobile app, which signs in directly against Supabase Auth
// and therefore cannot be trusted to police itself. The caller posts the
// normalised e-mail and an outcome; the function answers from the server-side
// attempt ledger created by `0110_security_hardening.sql`.
//
//   outcome "check"  -> { allowed } (or 429 with retryAfterSeconds)
//   outcome "record" -> appends a failure, or clears the counter on success
//
// Threat model (see docs/fixes-20-2026.md, M1):
//  - Anyone can call this endpoint. A public endpoint that lets a stranger
//    report "user X failed" for any e-mail is a trivial lockout, and letting a
//    stranger report "user X succeeded" is a trivial lockout reset.
//  - Counters are therefore keyed by e-mail *and* the caller's network, taken
//    from the request headers rather than the body. Recording failures can only
//    exhaust the caller's own budget for that address, never someone else's.
//  - Clearing is only accepted with the access token of the account that just
//    signed in. A token whose e-mail differs from the identifier clears
//    nothing, so one account cannot reset another's counter.
//  - A failure in the ledger never blocks a sign-in attempt in code here: the
//    caller treats unreachable answers as "allowed" and always runs the real
//    credential check itself.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';

const WINDOW_SECONDS = 900;
const MAX_FAILED = 8;
const MAX_IDENTIFIER_LENGTH = 254;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/** The caller's network, from headers the platform controls. */
function sourceOf(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  // The right-most entry is the one appended by the proxy closest to us, so a
  // client cannot prepend a fake address.
  const forwarded = req.headers.get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return forwarded?.[forwarded.length - 1] ?? 'unknown';
}

/** Counter identity: one bucket per (account, network). */
function ledgerKey(identifier: string, source: string): string {
  return `mobile-login:${identifier}|${source}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await req.json().catch(() => null);
    const rawIdentifier = typeof body?.identifier === 'string' ? body.identifier : '';
    const identifier = rawIdentifier.trim().toLowerCase();
    const outcome = body?.outcome;
    const success = body?.success === true;

    if (!EMAIL_RE.test(identifier) || identifier.length > MAX_IDENTIFIER_LENGTH) {
      return json({ error: 'invalid_identifier' }, 400);
    }

    const supabase = adminClient();
    const key = ledgerKey(identifier, sourceOf(req));

    if (outcome === 'record') {
      if (success) {
        // Proof that this caller really signed in as this account.
        const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
        if (!token) return json({ error: 'proof_required' }, 401);

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        const signedInEmail = (userData?.user?.email ?? '').trim().toLowerCase();
        if (userError || !signedInEmail || signedInEmail !== identifier) {
          // Do not touch any counter: this account may not clear another's.
          return json({ error: 'proof_invalid' }, 403);
        }

        const { error } = await supabase.rpc('clear_auth_attempts', { p_identifier: key });
        if (error) console.error('auth-gate clear failed', error);
        return json({ recorded: true, cleared: !error });
      }

      const { error } = await supabase.rpc('record_auth_attempt', {
        p_identifier: key,
        p_success: false,
      });
      if (error) console.error('auth-gate record failed', error);
      return json({ recorded: !error });
    }

    if (outcome === 'check') {
      const { data, error } = await supabase.rpc('auth_attempts_exceeded', {
        p_identifier: key,
        p_window_seconds: WINDOW_SECONDS,
        p_max_failed: MAX_FAILED,
      });
      if (error) {
        console.error('auth-attempts lookup failed', error);
        return json({ allowed: true });
      }
      if (data === true) return json({ allowed: false, retryAfterSeconds: WINDOW_SECONDS }, 429);
      return json({ allowed: true });
    }

    return json({ error: 'invalid_request' }, 400);
  } catch (err) {
    console.error('auth-gate failed', err);
    return json({ error: 'server_error' }, 500);
  }
});
