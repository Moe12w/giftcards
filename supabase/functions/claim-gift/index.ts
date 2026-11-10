// supabase/functions/claim-gift/index.ts
// Public claim endpoint. Hashes the token and delegates to public.claim_card(),
// which enforces single-use and rate limiting. No raw token is ever stored.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { sha256Hex } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const { token } = await req.json();
    if (typeof token !== 'string' || token.length < 32) {
      return json({ error: 'invalid_token' }, 400);
    }

    const tokenHash = await sha256Hex(token);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
        auth: { persistSession: false },
      },
    );

    const { data, error } = await supabase.rpc('claim_card', { p_token_hash: tokenHash });
    if (error) {
      const message = error.message ?? '';
      if (message.includes('already claimed')) return json({ error: 'already_claimed' }, 409);
      if (message.includes('too many')) return json({ error: 'rate_limited' }, 429);
      return json({ error: 'invalid_token' }, 400);
    }

    return json({ cardId: data });
  } catch (err) {
    console.error('claim-gift failed', err);
    return json({ error: 'server_error' }, 500);
  }
});
