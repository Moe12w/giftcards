import { describe, expect, it } from 'vitest';

import { isValidQatarIban, normalizeIban } from './iban';

describe('Qatar IBAN validation', () => {
  // Canonical 29-character Qatar IBAN with valid check digits.
  const valid = 'QA58DOHB00001234567890ABCDEFG';

  it('accepts a valid Qatar IBAN', () => {
    expect(isValidQatarIban(valid)).toBe(true);
  });

  it('accepts spaces and hyphens and lowercase letters', () => {
    expect(isValidQatarIban('qa58 dohb 00001234567890 abcdefg')).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    expect(isValidQatarIban('QA00DOHB00001234567890ABCDEFG')).toBe(false);
  });

  it('rejects wrong length, country or characters', () => {
    expect(isValidQatarIban('Qa163739100273892')).toBe(false);
    expect(isValidQatarIban('SA58DOHB00001234567890ABCDEFG')).toBe(false);
    expect(isValidQatarIban('QA58DOHB00001234567890ABCDEFG@')).toBe(false);
  });

  it('normalizes for storage', () => {
    expect(normalizeIban(' qa58 dohb 00001234567890 abcdefg ')).toBe(valid);
  });
});
