// supabase/functions/wallet-pass/index.ts
// Gift cards in Apple Wallet and Google Wallet.
//
// Two jobs, one function:
//
//   POST /wallet-pass                     app-only actions: `links`, `sync`
//   GET  /wallet-pass/apple/{id}/{token}   the signed .pkpass Safari opens
//   GET  /wallet-pass/v1/...               the Apple Wallet web service
//
// Apple passes are rebuilt from the voucher on every request, so a pass fetched
// again is never stale; Wallet refreshes a pass when the user opens it or pulls
// to refresh, which is why no APNs push is sent (see the note in apple.ts). The
// device registration calls are answered and stored for a future push sender;
// with nothing pushed there is no `passesUpdatedSince` listing to serve.
// Google objects are updated when a redemption is detected by `sync`.
//
// Nothing is served until the credentials exist. A missing certificate is a
// clean 503, not a broken pass.

import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import {
  appleConfig,
  buildPkpass,
  walletBaseUrl,
  walletTokenSecret,
} from '../_shared/wallet/apple.ts';
import { applePass, googleGiftCardObject } from '../_shared/wallet/content.ts';
import {
  ensureGoogleObject,
  googleIssuerId,
  googleServiceAccount,
  googleWalletSaveUrl,
  updateGoogleObject,
} from '../_shared/wallet/google.ts';
import { tokenIsValid, voucherPassToken } from '../_shared/wallet/token.ts';
import { callerId, loadVoucherForPass, type VoucherForPass } from '../_shared/wallet/vouchers.ts';

const PKPASS = 'application/vnd.apple.pkpass';

function unauthorized(): Response {
  return json({ error: 'unauthorized' }, 401);
}

function notConfigured(provider: string): Response {
  return json({ error: 'wallet_not_configured', provider }, 503);
}

function pkpassResponse(body: Uint8Array): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': PKPASS,
      'Content-Disposition': 'attachment; filename="tazella.pkpass"',
      'Cache-Control': 'no-store',
    },
  });
}

function appleToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^ApplePass\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function signedPass(found: VoucherForPass, token: string): Promise<Uint8Array> {
  const config = appleConfig();
  if (!config) throw new Error('wallet_not_configured');

  const passJson = applePass({
    voucher: found.voucher,
    passTypeId: config.passTypeId,
    teamId: config.teamId,
    webServiceUrl: walletBaseUrl(),
    authenticationToken: token,
  });
  return buildPkpass(passJson, config);
}

/**
 * The voucher named in the request body, if the caller holds it; otherwise the
 * response to send back. Only the person holding the card gets a pass for it:
 * the buyer of a gift somebody else claimed is not the holder.
 */
async function holderVoucher(req: Request): Promise<VoucherForPass | Response> {
  const userId = await callerId(req);
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => null);
  const voucherId = typeof body?.voucherId === 'string' ? body.voucherId.trim() : '';
  const found = voucherId ? await loadVoucherForPass(voucherId) : null;
  if (!found) return json({ error: 'not_found' }, 404);
  if (found.claimedBy !== userId) return json({ error: 'forbidden' }, 403);
  return found;
}

async function handleLinks(req: Request): Promise<Response> {
  const found = await holderVoucher(req);
  if (found instanceof Response) return found;

  const result: {
    apple: string | null;
    google: string | null;
    appleError?: string;
    googleError?: string;
  } = { apple: null, google: null };

  const secret = walletTokenSecret();
  if (!secret || !appleConfig()) {
    result.appleError = 'not_configured';
  } else {
    const token = await voucherPassToken(secret, found.voucher.id);
    result.apple = `${walletBaseUrl()}/apple/${found.voucher.id}/${token}`;
  }

  const serviceAccount = googleServiceAccount();
  const issuerId = googleIssuerId();
  if (!serviceAccount || !issuerId) {
    result.googleError = 'not_configured';
  } else {
    try {
      const object = googleGiftCardObject({ issuerId, voucher: found.voucher });
      await ensureGoogleObject(serviceAccount, issuerId, object);
      result.google = await googleWalletSaveUrl(serviceAccount, object);
    } catch (error) {
      console.error('wallet-pass google link failed', String(error));
      result.googleError = 'provider_error';
    }
  }

  return json(result);
}

/**
 * Brings an already-saved Google object up to date. Called after a redemption,
 * when the balance on the passes may have changed. A pass that was never saved
 * is simply a 404 inside updateGoogleObject.
 */
async function handleSync(req: Request): Promise<Response> {
  const found = await holderVoucher(req);
  if (found instanceof Response) return found;

  const serviceAccount = googleServiceAccount();
  const issuerId = googleIssuerId();
  if (!serviceAccount || !issuerId) return json({ synced: false });

  try {
    const object = googleGiftCardObject({ issuerId, voucher: found.voucher });
    const synced = await updateGoogleObject(serviceAccount, object);
    return json({ synced });
  } catch (error) {
    console.error('wallet-pass sync failed', String(error));
    return json({ synced: false });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/wallet-pass/, '');
  const segments = path.split('/').filter(Boolean);

  try {
    // Apple Wallet calls these with `Authorization: ApplePass <token>`.
    if (segments[0] === 'v1') {
      const secret = walletTokenSecret();
      if (!secret) return notConfigured('apple');

      if (segments[1] === 'log' && req.method === 'POST') {
        const body = await req.text().catch(() => '');
        if (body) console.error('apple wallet log', body.slice(0, 500));
        return new Response('ok');
      }

      if (segments[1] === 'passes' && req.method === 'GET') {
        const passTypeId = segments[2] ?? '';
        const serial = segments[3] ?? '';
        const token = appleToken(req);
        if (!token) return unauthorized();
        if (!(await tokenIsValid(secret, token, serial))) return unauthorized();

        const config = appleConfig();
        if (!config) return notConfigured('apple');
        if (config.passTypeId !== decodeURIComponent(passTypeId)) return json({ error: 'not_found' }, 404);

        const found = await loadVoucherForPass(serial);
        if (!found) return json({ error: 'not_found' }, 404);
        return pkpassResponse(await signedPass(found, token));
      }

      if (segments[1] === 'devices') {
        const device = decodeURIComponent(segments[2] ?? '');
        if (segments[3] !== 'registrations' || !device) return json({ error: 'not_found' }, 404);

        // POST or DELETE /v1/devices/{device}/registrations/{passType}/{serial}
        if (segments.length === 6 && (req.method === 'POST' || req.method === 'DELETE')) {
          const admin = adminClient();
          const passTypeId = decodeURIComponent(segments[4] ?? '');
          const serial = decodeURIComponent(segments[5] ?? '');
          const token = appleToken(req);
          if (!token) return unauthorized();
          if (!(await tokenIsValid(secret, token, serial))) return unauthorized();

          const config = appleConfig();
          if (!config) return notConfigured('apple');
          if (config.passTypeId !== passTypeId) return json({ error: 'not_found' }, 404);

          if (req.method === 'DELETE') {
            await admin
              .from('wallet_pass_registrations')
              .delete()
              .eq('device_library_id', device)
              .eq('voucher_id', serial);
            return new Response('ok', { status: 200 });
          }

          const body = await req.json().catch(() => null);
          const pushToken =
            typeof body?.pushToken === 'string' ? body.pushToken.trim() : '';
          if (!pushToken) return json({ error: 'push_token_required' }, 400);

          const { data: existing } = await admin
            .from('wallet_pass_registrations')
            .select('voucher_id')
            .eq('device_library_id', device)
            .eq('voucher_id', serial)
            .maybeSingle();

          const { error } = await admin.from('wallet_pass_registrations').upsert(
            {
              device_library_id: device,
              pass_type_id: passTypeId,
              voucher_id: serial,
              push_token: pushToken,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'device_library_id,voucher_id' },
          );
          if (error) throw error;

          return new Response('ok', { status: existing ? 200 : 201 });
        }

        return json({ error: 'not_found' }, 404);
      }

      return json({ error: 'not_found' }, 404);
    }

    // GET /wallet-pass/apple/{id}/{token}: the download Safari hands to Wallet.
    if (segments[0] === 'apple' && req.method === 'GET') {
      const voucherId = decodeURIComponent(segments[1] ?? '');
      const token = decodeURIComponent(segments[2] ?? '');
      const secret = walletTokenSecret();
      if (!secret) return notConfigured('apple');
      if (!(await tokenIsValid(secret, token, voucherId))) return unauthorized();

      const found = await loadVoucherForPass(voucherId);
      if (!found) return json({ error: 'not_found' }, 404);
      return pkpassResponse(await signedPass(found, token));
    }

    if (req.method === 'POST' && segments.length === 0) {
      const body = await req.json().catch(() => null);
      const action = typeof body?.action === 'string' ? body.action : '';
      if (action === 'links') return await handleLinks(req);
      if (action === 'sync') return await handleSync(req);
      return json({ error: 'unknown_action' }, 400);
    }

    if (req.method === 'GET' && segments.length === 0) {
      return json({
        ok: true,
        apple: Boolean(appleConfig() && walletTokenSecret()),
        google: Boolean(googleServiceAccount() && googleIssuerId()),
      });
    }

    return json({ error: 'not_found' }, 404);
  } catch (error) {
    const message = String(error);
    if (message.includes('wallet_not_configured')) return notConfigured('apple');
    console.error('wallet-pass failed', message);
    return json({ error: 'server_error' }, 500);
  }
});
