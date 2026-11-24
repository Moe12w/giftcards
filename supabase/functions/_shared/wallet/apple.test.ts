// supabase/functions/_shared/wallet/apple.test.ts
// Signs a real `.pkpass` offline with throwaway self-signed certificates and
// checks it the way Wallet does: the zip holds the pass and its icons, the
// manifest lists every one of those files with its SHA-1, and the detached
// PKCS#7 over the manifest verifies against the pass certificate.
//
// The code under test imports its packages with Deno specifiers (`npm:...`);
// vitest.config.mts maps them to the Node dev-dependency copies, so this runs
// the same signing code the Edge Function runs, without a certificate or
// network.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { unzipSync } from 'fflate';
import forge from 'node-forge';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildPkpass, type AppleWalletConfig } from './apple';

const PASSPHRASE = 'pkpass-test';
const PASS_TYPE_ID = 'pass.qa.giftly.card';
const TEAM_ID = 'TEAM123456';
const WWDR_CN = 'Apple WWDR test intermediate';

const PASS_JSON = {
  formatVersion: 1,
  passTypeIdentifier: PASS_TYPE_ID,
  serialNumber: '8a1f0c2e-1111-4a2b-9c3d-000000000001',
  teamIdentifier: TEAM_ID,
  organizationName: 'Tazilla',
  description: 'Bayt Al Shaar gift card',
  logoText: 'Tazilla',
  storeCard: {
    primaryFields: [{ key: 'balance', label: 'BALANCE', value: 'QAR 75.00' }],
  },
  barcodes: [
    {
      format: 'PKBarcodeFormatQR',
      message: 'giftly:card:8a1f0c2e-1111-4a2b-9c3d-000000000001',
      messageEncoding: 'iso-8859-1',
    },
  ],
};

const ICONS = ['icon.png', 'icon@2x.png', 'icon@3x.png'];
const SIGNED_FILES = ['pass.json', ...ICONS, 'manifest.json'];
// The manifest cannot list itself, so it covers everything but manifest.json.
const MANIFESTED_FILES = ['pass.json', ...ICONS];

let passCertificate: forge.pki.Certificate;
let files: Record<string, Uint8Array>;

function binary(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

function sha1(bytes: Uint8Array): string {
  return createHash('sha1').update(bytes).digest('hex');
}

/** A self-signed stand-in for an Apple-issued certificate. */
function selfSigned(commonName: string) {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(8));
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const subject = [{ name: 'commonName', value: commonName }];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    cert,
    certPem: forge.pki.certificateToPem(cert),
    // Encrypted PKCS#8, the shape a Pass Type ID key is exported in.
    keyPem: forge.pki.encryptRsaPrivateKey(keys.privateKey, PASSPHRASE),
  };
}

/**
 * SignedData from the signature's ContentInfo.
 *
 * forge writes ContentInfo → [0] EXPLICIT → SignedData, whose value list is
 * version, digestAlgorithms, encapContentInfo, certificates, signerInfos; and
 * one SignerInfo of version, issuerAndSerial, digestAlgorithm, the
 * authenticatedAttributes, the encryption algorithm and the signature.
 */
function signedData(signatureDer: Uint8Array): forge.asn1.Asn1 {
  const contentInfo = forge.asn1.fromDer(forge.util.createBuffer(binary(signatureDer)));
  expect(forge.asn1.derToOid(contentInfo.value[0].value)).toBe(forge.pki.oids.signedData);
  const data = contentInfo.value[1].value[0];
  expect(data.value).toHaveLength(5);
  return data;
}

function signerInfo(signatureDer: Uint8Array): forge.asn1.Asn1 {
  const signerInfos = signedData(signatureDer).value[4];
  expect(signerInfos.value).toHaveLength(1);
  return signerInfos.value[0];
}

/** Authenticated attributes as OID → readable value (a digest as hex, dates as text). */
function authenticatedAttributes(signatureDer: Uint8Array): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const attribute of signerInfo(signatureDer).value[3].value) {
    const type = forge.asn1.derToOid(attribute.value[0].value);
    const value = attribute.value[1].value[0].value;
    if (type === forge.pki.oids.contentType) attributes[type] = forge.asn1.derToOid(value);
    else if (type === forge.pki.oids.messageDigest) attributes[type] = forge.util.bytesToHex(value);
    else attributes[type] = value;
  }
  return attributes;
}

/**
 * The RSA check Wallet performs: the signature is over the authenticated
 * attributes re-tagged as a SET, and it is verified with the pass certificate.
 */
function signatureIsValid(signatureDer: Uint8Array): boolean {
  const info = signerInfo(signatureDer);
  const attributes = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SET,
    true,
    info.value[3].value,
  );
  const digest = forge.md.sha1
    .create()
    .update(forge.asn1.toDer(attributes).getBytes())
    .digest();
  try {
    return passCertificate.publicKey.verify(digest.getBytes(), info.value[5].value);
  } catch {
    // forge throws, rather than returning false, when the padding is garbage.
    return false;
  }
}

beforeAll(async () => {
  const pass = selfSigned(`Pass Type ID: ${PASS_TYPE_ID}`);
  const wwdr = selfSigned(WWDR_CN);
  passCertificate = pass.cert;

  const config: AppleWalletConfig = {
    passTypeId: PASS_TYPE_ID,
    teamId: TEAM_ID,
    certificatePem: pass.certPem,
    keyPem: pass.keyPem,
    keyPassword: PASSPHRASE,
    wwdrPem: wwdr.certPem,
  };
  files = unzipSync(await buildPkpass(PASS_JSON, config));
});

describe('pkpass archive', () => {
  it('holds the pass, its icons, the manifest and one signature', () => {
    expect(Object.keys(files).sort()).toEqual([...SIGNED_FILES, 'signature'].sort());
  });

  it('stores pass.json byte for byte as it was given', () => {
    expect(new TextDecoder().decode(files['pass.json'])).toBe(JSON.stringify(PASS_JSON));
  });

  it('ships the three icon sizes as PNGs', () => {
    for (const name of ICONS) {
      expect(Array.from(files[name].slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
    expect(files['icon@2x.png'].length).toBeGreaterThan(files['icon.png'].length);
    expect(files['icon@3x.png'].length).toBeGreaterThan(files['icon@2x.png'].length);
  });

  it('lists every pass file in the manifest with its SHA-1', () => {
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json'])) as Record<
      string,
      string
    >;
    expect(Object.keys(manifest).sort()).toEqual([...MANIFESTED_FILES].sort());
    for (const name of MANIFESTED_FILES) {
      expect(manifest[name]).toBe(sha1(files[name]));
    }
  });
});

describe('pkpass signature', () => {
  it('is detached and signs the manifest with SHA-1', () => {
    const encapsulated = signedData(files['signature']).value[2];
    // Only the content type: no embedded content, which is what "detached" means.
    expect(encapsulated.value).toHaveLength(1);

    expect(forge.asn1.derToOid(signerInfo(files['signature']).value[2].value[0].value)).toBe(
      forge.pki.oids.sha1,
    );
    const attributes = authenticatedAttributes(files['signature']);
    expect(attributes[forge.pki.oids.contentType]).toBe(forge.pki.oids.data);
    expect(attributes[forge.pki.oids.messageDigest]).toBe(sha1(files['manifest.json']));
    expect(attributes[forge.pki.oids.signingTime]).toMatch(/Z$/);
  });

  it('verifies against the pass certificate and carries the WWDR certificate', () => {
    expect(signatureIsValid(files['signature'])).toBe(true);

    const certificates = signedData(files['signature']).value[3].value.map(
      (node: forge.asn1.Asn1) => forge.pki.certificateFromAsn1(node),
    );
    const commonNames = certificates.map(
      (cert: forge.pki.Certificate) => cert.subject.getField('CN').value,
    );
    expect(commonNames.sort()).toEqual([`Pass Type ID: ${PASS_TYPE_ID}`, WWDR_CN].sort());
  });

  it('fails once the signature bytes are altered', () => {
    // The encrypted digest is the last element of the DER, so flipping its last
    // byte keeps the ASN.1 structure parseable and only the signature invalid.
    const altered = Uint8Array.from(files['signature']);
    altered[altered.length - 1] ^= 0xff;
    expect(signatureIsValid(altered)).toBe(false);
  });
});

// The alias in vitest.config.mts maps the Deno specifier to whatever the root
// dev-dependency resolves to, so a bump there would quietly test a different
// library than the one the Edge Function runs.
describe('test wiring', () => {
  it('runs the node-forge version the function imports', () => {
    const source = readFileSync(new URL('./apple.ts', import.meta.url), 'utf8');
    const imported = source.match(/import forge from 'npm:node-forge@([\d.]+)';/)?.[1];
    const manifest = JSON.parse(
      readFileSync(createRequire(import.meta.url).resolve('node-forge/package.json'), 'utf8'),
    ) as { version: string };
    expect(imported).toBe(manifest.version);
  });
});
