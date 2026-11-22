// supabase/functions/_shared/wallet/google.ts
// Google Wallet: object upsert and "Save to Google Wallet" links.
//
// Google does not take a file. The app (or the web service) creates a gift card
// object through the Wallet API with a service account, then hands the user a
// save URL that carries a signed JWT. Balance updates are PATCHes on the same
// object, so a redemption on our side can be reflected without the user doing
// anything.

import { googleSaveClaims, googleSaveUrl, googleAuthClaims, signRs256 } from './jwt.ts';

const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';

export interface GoogleServiceAccount {
  clientEmail: string;
  privateKey: string;
}

export function googleIssuerId(): string | null {
  const value = Deno.env.get('GOOGLE_WALLET_ISSUER_ID')?.trim();
  return value || null;
}

/**
 * The service account JSON, either raw or base64. `supabase secrets set` is
 * happier with one line, so accept both instead of asking for a specific form.
 */
export function googleServiceAccount(): GoogleServiceAccount | null {
  const raw = Deno.env.get('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON')?.trim();
  if (!raw) return null;

  let json = raw;
  if (!raw.startsWith('{')) {
    try {
      json = atob(raw);
    } catch {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(json) as { client_email?: unknown; private_key?: unknown };
    if (typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') {
      return null;
    }
    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, '\n'),
    };
  } catch {
    return null;
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;
let classReadyFor: string | null = null;

async function accessToken(serviceAccount: GoogleServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const assertion = await signRs256(
    googleAuthClaims({ clientEmail: serviceAccount.clientEmail, tokenUri: TOKEN_URI, issuedAt: now }),
    serviceAccount.privateKey,
  );

  const response = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`google_token_failed:${response.status}`);
  }

  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error('google_token_failed:no_token');

  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

async function authorized(
  serviceAccount: GoogleServiceAccount,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const token = await accessToken(serviceAccount);
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/** Gift card classes must exist once per issuer before any object can use them. */
async function ensureClass(
  serviceAccount: GoogleServiceAccount,
  issuerId: string,
): Promise<void> {
  const classId = `${issuerId}.giftly_giftcard_v1`;
  if (classReadyFor === classId) return;

  const response = await authorized(serviceAccount, `${WALLET_API}/giftCardClass`, {
    method: 'POST',
    body: JSON.stringify({
      id: classId,
      issuerName: 'Giftly',
      reviewStatus: 'UNDER_REVIEW',
      hexBackgroundColor: '#0B4A44',
    }),
  });

  // 409: already created by an earlier call or another instance.
  if (!response.ok && response.status !== 409) {
    throw new Error(`google_class_failed:${response.status}`);
  }
  classReadyFor = classId;
}

export async function ensureGoogleObject(
  serviceAccount: GoogleServiceAccount,
  issuerId: string,
  object: Record<string, unknown>,
): Promise<void> {
  await ensureClass(serviceAccount, issuerId);

  const created = await authorized(serviceAccount, `${WALLET_API}/giftCardObject`, {
    method: 'POST',
    body: JSON.stringify(object),
  });
  if (created.ok || created.status === 409) return;

  // An object that already exists comes back as a duplicate error on some
  // revisions of the API; updating it is the outcome we wanted anyway.
  if (await updateGoogleObject(serviceAccount, object)) return;
  throw new Error(`google_object_failed:${created.status}`);
}

/** Updates balance/state of an object that is already published. */
export async function updateGoogleObject(
  serviceAccount: GoogleServiceAccount,
  object: Record<string, unknown>,
): Promise<boolean> {
  const id = String(object.id ?? '');
  if (!id) return false;

  const updates: Record<string, unknown> = {
    state: object.state,
    textModulesData: object.textModulesData,
    barcode: object.barcode,
  };
  if (object.balance) updates.balance = object.balance;

  const response = await authorized(
    serviceAccount,
    `${WALLET_API}/giftCardObject/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    },
  );

  // 404 simply means the user never saved the pass. Nothing to update.
  return response.ok;
}

export async function googleWalletSaveUrl(
  serviceAccount: GoogleServiceAccount,
  object: Record<string, unknown>,
): Promise<string> {
  const jwt = await signRs256(
    googleSaveClaims({
      clientEmail: serviceAccount.clientEmail,
      issuedAt: Math.floor(Date.now() / 1000),
      object,
    }),
    serviceAccount.privateKey,
  );
  return googleSaveUrl(jwt);
}
