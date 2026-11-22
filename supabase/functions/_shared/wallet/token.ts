// supabase/functions/_shared/wallet/token.ts
// The per-pass authentication token.
//
// Wallet sends the token back on every web service call, and the pass content is
// rebuilt from the voucher rather than stored, so the token has to be derivable:
// `<voucher id>.<hmac>` where the HMAC uses a server secret. That also lets the
// web service identify which pass a token belongs to without a lookup table, and
// invalidates every issued token at once if the secret is rotated.

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** 32 lowercase hex characters, no dashes. */
export function compactVoucherId(voucherId: string): string {
  return voucherId.replace(/-/g, '').toLowerCase();
}

export function expandVoucherId(compact: string): string | null {
  const value = compact.trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(value)) return null;
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20),
  ].join('-');
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toHex(new Uint8Array(signature));
}

export async function voucherPassToken(secret: string, voucherId: string): Promise<string> {
  const compact = compactVoucherId(voucherId);
  return `${compact}.${(await hmac(secret, compact)).slice(0, 40)}`;
}

/** The voucher id inside a well-formed token, without checking the signature. */
export function tokenVoucherId(token: string): string | null {
  const [compact, signature] = token.split('.');
  if (!compact || !signature) return null;
  return expandVoucherId(compact);
}

export async function tokenIsValid(
  secret: string,
  token: string,
  voucherId: string,
): Promise<boolean> {
  const expected = await voucherPassToken(secret, voucherId);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ token.charCodeAt(index);
  }
  return diff === 0;
}
