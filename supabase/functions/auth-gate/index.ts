// supabase/functions/auth-gate/index.ts
// Login gate shared by the web dashboards and the mobile app. The caller posts
// the normalised identifier (e-mail or `ip:<address>`) and an outcome; the
// function answers from the server-side attempt ledger that migrations
// `0110_security_hardening.sql` creates, so the throttle is enforced in one
// place and never trusts the client to police itself.
//
//   outcome "check"  -> returns { allowed } (or 429 with retryAfterSeconds)
//   outcome "record" -> appends/clears the ledger entry for the attempt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';

const WINDOW_SECONDS = 900;
const MAX_FAILED = 8;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await req.json();
    const rawIdentifier = typeof body?.identifier === 'string' ? body.identifier : '';
    const identifier = rawIdentifier.trim().toLowerCase();
    const ip = typeof body?.ip === 'string' && body.ip.trim() ? body.ip.trim() : null;
    const outcome = body?.outcome;
    const success = body?.success === true;

    const supabase = adminClient();

    if (outcome === 'record') {
      try {
        await supabase.rpc('record_auth_attempt', { p_identifier: identifier, p_success: success });
        if (ip) await supabase.rpc('record_auth_attempt', { p_identifier: `ip:${ip}`, p_success: success });
        if (success) {
          await supabase.rpc('clear_auth_attempts', { p_identifier: identifier });
          if (ip) await supabase.rpc('clear_auth_attempts', { p_identifier: `ip:${ip}` });
        }
      } catch (err) {
        console.error('auth-gate record failed', err);
      }
      return json({ recorded: true });
    }

    if (outcome === 'check') {
      const { data, error } = await supabase.rpc('auth_attempts_exceeded', {
        p_identifier: identifier,
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
