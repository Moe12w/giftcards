// supabase/functions/claim-preview/index.ts
// Public read-only view of a claim link, in front of `claim_preview`.
//
// The database function needs the caller's network address to enforce a
// per-caller limit, and PostgREST does not reliably forward one. The Edge
// Function runtime does see it, so it passes the address it observed and calls
// `claim_preview` with the service role (the function is not callable by anon).
//
// The raw token is forwarded to the database, which hashes it; it is never
// logged here. A rate-limited caller gets 429, an unknown link gets a normal
// empty answer so the page can show "not found".
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';

const MAX_TOKEN_LENGTH = 512;

function sourceOf(req: Request): string | null {
  // Only headers the platform sets. A client-supplied X-Real-IP would let a
  // caller rotate the per-IP rate-limit bucket at will.
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  // The right-most XFF entry is appended by the proxy closest to us; a client
  // cannot control it by prepending values.
  const forwarded = req.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return forwarded?.[forwarded.length - 1] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await req.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (token.length < 16 || token.length > MAX_TOKEN_LENGTH) {
      return json({ gift: null });
    }

    const admin = adminClient();
    const { data, error } = await admin.rpc('claim_preview', {
      p_token: token,
      p_source: sourceOf(req),
    });

    if (error) {
      if (String(error.message ?? '').includes('too_many_requests')) {
        return json({ error: 'too_many_requests', gift: null }, 429);
      }
      console.error('claim-preview failed', error.message);
      return json({ gift: null }, 500);
    }

    const gift = Array.isArray(data) ? data[0] ?? null : data ?? null;
    return json({ gift });
  } catch (err) {
    console.error('claim-preview failed', String(err));
    return json({ gift: null }, 500);
  }
});
