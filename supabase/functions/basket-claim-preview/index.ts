// supabase/functions/basket-claim-preview/index.ts
// Public read-only view of a basket claim link, mirroring claim-preview.
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';

const MAX_TOKEN_LENGTH = 512;

function sourceOf(req: Request): string | null {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
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
      return json({ basket: null });
    }

    const admin = adminClient();
    const { data, error } = await admin.rpc('basket_claim_preview', {
      p_token: token,
      p_source: sourceOf(req),
    });

    if (error) {
      console.error('basket-claim-preview failed', error.message);
      return json({ basket: null }, 500);
    }

    const basket = Array.isArray(data) ? data[0] ?? null : data ?? null;
    return json({ basket });
  } catch (err) {
    console.error('basket-claim-preview failed', String(err));
    return json({ basket: null }, 500);
  }
});