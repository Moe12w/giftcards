// supabase/functions/_shared/iban.ts
// Qatar IBAN validation (ISO 13616), mirrored from web/lib/iban.ts.

export function normalizeIban(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidQatarIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^QA\d{2}[A-Z0-9]{25}$/.test(iban)) return false;

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
