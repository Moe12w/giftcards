// supabase/functions/_shared/wallet/apple.ts
// Builds and signs an Apple Wallet `.pkpass`.
//
// A pass is a zip of pass.json, its images, a manifest of SHA-1 hashes, and a
// detached PKCS#7 signature over that manifest made with the Pass Type ID
// certificate plus the Apple WWDR intermediate. PKCS#7 comes from node-forge
// (the same library every pass server uses) and the zip from fflate.
//
// Nothing here runs until the secrets exist: without a certificate the caller
// gets `null` from appleConfig() and the function answers "not configured".

import forge from 'npm:node-forge@1.3.1';
import { zipSync } from 'npm:fflate@0.8.2';

import { APPLE_ICON_2X_PNG, APPLE_ICON_3X_PNG, APPLE_ICON_PNG } from './pass-assets.ts';

export interface AppleWalletConfig {
  passTypeId: string;
  teamId: string;
  certificatePem: string;
  keyPem: string;
  keyPassword: string | null;
  wwdrPem: string;
}

/** Edge secrets arrive with escaped newlines far too often. */
function pem(value: string | undefined): string {
  return (value ?? '').replace(/\\n/g, '\n').trim();
}

function secret(name: string): string {
  return pem(Deno.env.get(name));
}

export function appleConfig(): AppleWalletConfig | null {
  const passTypeId = secret('APPLE_PASS_TYPE_ID');
  const teamId = secret('APPLE_TEAM_ID');
  const certificatePem = secret('APPLE_PASS_CERT_PEM');
  const keyPem = secret('APPLE_PASS_KEY_PEM');
  const wwdrPem = secret('APPLE_WWDR_CERT_PEM');
  if (!passTypeId || !teamId || !certificatePem || !keyPem || !wwdrPem) return null;
  return {
    passTypeId,
    teamId,
    certificatePem,
    keyPem,
    keyPassword: Deno.env.get('APPLE_PASS_PASSWORD') || null,
    wwdrPem,
  };
}

/** The secret the per-pass authentication tokens are derived from. */
export function walletTokenSecret(): string | null {
  return Deno.env.get('WALLET_PASS_TOKEN_SECRET')?.trim() || null;
}

/** Public base of this function, as Apple Wallet will call it. */
export function walletBaseUrl(): string {
  const override = Deno.env.get('WALLET_PUBLIC_BASE_URL')?.trim();
  if (override) return override.replace(/\/+$/, '');
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  return `${supabaseUrl}/functions/v1/wallet-pass`;
}

const encoder = new TextEncoder();

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function manifestFor(files: Record<string, Uint8Array>): Promise<string> {
  const manifest: Record<string, string> = {};
  for (const [name, contents] of Object.entries(files)) {
    const digest = await crypto.subtle.digest('SHA-1', contents);
    manifest[name] = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  return JSON.stringify(manifest);
}

function privateKey(config: AppleWalletConfig) {
  const keyPem = config.keyPem;
  if (config.keyPassword) {
    const decrypted = forge.pki.decryptRsaPrivateKey(keyPem, config.keyPassword);
    if (decrypted) return decrypted;
    throw new Error('APPLE_PASS_KEY_PEM could not be decrypted with APPLE_PASS_PASSWORD');
  }
  return forge.pki.privateKeyFromPem(keyPem);
}

function signManifest(manifest: string, config: AppleWalletConfig): Uint8Array {
  const certificate = forge.pki.certificateFromPem(config.certificatePem);
  const wwdr = forge.pki.certificateFromPem(config.wwdrPem);

  const p7 = forge.pkcs7.createSignedData();
  // UTF-8: vendor names can be Arabic, and the manifest hashes the pass.json
  // bytes, so the signature has to be over exactly those bytes.
  p7.content = forge.util.createBuffer(manifest, 'utf8');
  p7.addCertificate(wwdr);
  p7.addCertificate(certificate);
  p7.addSigner({
    key: privateKey(config),
    certificate,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: true });

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return base64ToBytes(btoa(der));
}

/** pass.json plus its images, manifest and signature, zipped. */
export async function buildPkpass(
  passJson: Record<string, unknown>,
  config: AppleWalletConfig,
): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {
    'pass.json': encoder.encode(JSON.stringify(passJson)),
    'icon.png': base64ToBytes(APPLE_ICON_PNG),
    'icon@2x.png': base64ToBytes(APPLE_ICON_2X_PNG),
    'icon@3x.png': base64ToBytes(APPLE_ICON_3X_PNG),
  };

  const manifest = await manifestFor(files);
  files['manifest.json'] = encoder.encode(manifest);
  files['signature'] = signManifest(manifest, config);

  // Uncompressed: pass archives are tiny and some Wallet builds are picky about
  // deflate streams in a pass the user re-downloads.
  return zipSync(files, { level: 0 });
}
