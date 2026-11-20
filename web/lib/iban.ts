// web/lib/iban.ts
// Qatar IBAN validation (ISO 13616). The provider rejects a format-valid but
// checksum-invalid IBAN with a generic error, so the check digits must be
// verified before the application can be saved or a supplier is created.

export const QATAR_IBAN_LENGTH = 29;
const QATAR_IBAN_SHAPE = /^QA\d{2}[A-Z0-9]{25}$/;

export function normalizeIban(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

/** Returns true only for a well-formed Qatar IBAN whose mod-97 remainder is 1. */
export function isValidQatarIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (iban.length !== QATAR_IBAN_LENGTH || !QATAR_IBAN_SHAPE.test(iban)) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const numeric = char >= 'A' && char <= 'Z' ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of numeric) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

export const QATAR_IBAN_HINT =
  'Enter a valid Qatar IBAN (QA + 2 check digits + 22 letters/numbers = 29 characters). Spaces and hyphens are allowed.';
