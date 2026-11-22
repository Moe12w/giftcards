// supabase/functions/_shared/wallet/jwt.ts
// RS256 JWT helpers for Google Wallet.
//
// WebCrypto only: the same code runs in the Edge Function runtime and in the
// Node test run, so the Google save link and OAuth assertion can be tested
// without a Google account.

const encoder = new TextEncoder();

export function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  if (!body) throw new Error('empty private key');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function importRsaPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToDer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function signRs256(
  claims: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  const key = await importRsaPrivateKey(privateKeyPem);
  const signingInput = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(
    JSON.stringify(claims),
  )}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signingInput),
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

/** The assertion the OAuth token endpoint exchanges for an access token. */
export function googleAuthClaims(input: {
  clientEmail: string;
  tokenUri: string;
  issuedAt: number;
}): Record<string, unknown> {
  return {
    iss: input.clientEmail,
    scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
    aud: input.tokenUri,
    iat: input.issuedAt,
    exp: input.issuedAt + 3600,
  };
}

/** The "Save to Google Wallet" JWT for one object. */
export function googleSaveClaims(input: {
  clientEmail: string;
  issuedAt: number;
  object: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    iss: input.clientEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: input.issuedAt,
    payload: { giftCardObjects: [input.object] },
  };
}

export function googleSaveUrl(jwt: string): string {
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
