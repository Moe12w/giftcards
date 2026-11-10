// supabase/functions/wallet-pass/index.ts
// Generates Apple Wallet (.pkpass) and Google Wallet passes with a QR code.
//
// Secrets (Edge Function env only):
//   APPLE_PASS_CERT_PEM, APPLE_PASS_KEY_PEM, APPLE_PASS_PASSWORD,
//   APPLE_WWDR_CERT_PEM, APPLE_PASS_TYPE_ID, APPLE_TEAM_ID
//   GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_JSON
//
// NOTE: Pass content must never be trusted from the client. The balance shown
// on the pass is informational; redemption always reads the balance from the
// database at scan time.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const { cardId, platform } = await req.json();
    if (!cardId || !['apple', 'google'].includes(platform)) {
      return json({ error: 'invalid_request' }, 400);
    }

    // Identify the caller and confirm they may view this card.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: 'unauthorized' }, 401);

    const { data: card, error } = await userClient
      .from('gift_cards')
      .select('*, balance:card_balances(balance_minor)')
      .eq('id', cardId)
      .maybeSingle();
    if (error) throw error;
    if (!card) return json({ error: 'not_found' }, 404);

    if (platform === 'apple') {
      if (!Deno.env.get('APPLE_PASS_CERT_PEM')) {
        return json({ error: 'wallet_not_configured' }, 501);
      }
      // TODO: build the .pkpass archive (pass.json + images + manifest.json +
      // PKCS#7 signature) and return it as application/vnd.apple.pkpass.
      return json({ error: 'not_implemented' }, 501);
    }

    if (!Deno.env.get('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON')) {
      return json({ error: 'wallet_not_configured' }, 501);
    }
    // TODO: build the Google Wallet object + signed JWT, then return the
    // "Add to Google Wallet" save URL.
    void adminClient;
    return json({ error: 'not_implemented' }, 501);
  } catch (err) {
    console.error('wallet-pass failed', err);
    return json({ error: 'server_error' }, 500);
  }
});
