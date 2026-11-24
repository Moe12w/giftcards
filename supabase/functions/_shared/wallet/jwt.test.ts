import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  base64Url,
  googleAuthClaims,
  googleSaveClaims,
  googleSaveUrl,
  signRs256,
} from './jwt';

function keyPair() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function decode(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

describe('google wallet JWT', () => {
  it('base64url-encodes without padding', () => {
    expect(base64Url('hello')).toBe('aGVsbG8');
    expect(base64Url('a?')).toBe('YT8');
  });

  it('signs a save JWT the token endpoint would accept', async () => {
    const { privateKey, publicKey } = keyPair();
    const object = { id: '3388000000011111111.tazilla_abc' };
    const jwt = await signRs256(
      googleSaveClaims({
        clientEmail: 'passes@project.iam.gserviceaccount.com',
        issuedAt: 1_700_000_000,
        object,
      }),
      privateKey,
    );

    const [header, payload, signature] = jwt.split('.');
    expect(decode(header)).toMatchObject({ alg: 'RS256', typ: 'JWT' });
    expect(decode(payload)).toMatchObject({
      iss: 'passes@project.iam.gserviceaccount.com',
      aud: 'google',
      typ: 'savetowallet',
      payload: { giftCardObjects: [object] },
    });
    expect(
      verify(
        'RSA-SHA256',
        Buffer.from(`${header}.${payload}`),
        publicKey,
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
    expect(googleSaveUrl(jwt)).toBe(`https://pay.google.com/gp/v/save/${jwt}`);
  });

  it('asks for the wallet issuer scope', () => {
    expect(
      googleAuthClaims({
        clientEmail: 'passes@project.iam.gserviceaccount.com',
        tokenUri: 'https://oauth2.googleapis.com/token',
        issuedAt: 100,
      }),
    ).toEqual({
      iss: 'passes@project.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 100,
      exp: 3700,
    });
  });
});
