import { describe, expect, it } from 'vitest';
import {
  assertInteger,
  balanceFromEntries,
  commissionFor,
  formatMoney,
  isRedeemed,
  splitMoney,
  toMajorUnits,
  toMinorUnits,
  vendorShareFor,
} from './money';

describe('toMinorUnits', () => {
  it('converts whole and decimal amounts to fils', () => {
    expect(toMinorUnits('100')).toBe(10000);
    expect(toMinorUnits('12.50')).toBe(1250);
    expect(toMinorUnits('0.01')).toBe(1);
    expect(toMinorUnits(1.999)).toBe(200);
  });

  it('rejects non-numeric input', () => {
    expect(() => toMinorUnits('abc')).toThrow();
  });
});

describe('toMajorUnits', () => {
  it('converts fils back to major units', () => {
    expect(toMajorUnits(10000)).toBe(100);
    expect(toMajorUnits(1250)).toBe(12.5);
  });
});

describe('formatMoney', () => {
  it('formats QAR in English', () => {
    expect(formatMoney(123450, 'en')).toBe('QAR 1,234.50');
    expect(formatMoney(0, 'en')).toBe('QAR 0.00');
    expect(formatMoney(1, 'en')).toBe('QAR 0.01');
  });

  it('formats negative amounts', () => {
    expect(formatMoney(-1250, 'en')).toBe('-QAR 12.50');
  });

  it('formats QAR in Arabic', () => {
    const value = formatMoney(123450, 'ar');
    expect(value).toContain('ر.ق');
    expect(value).toContain('١');
  });
});

describe('splitMoney', () => {
  it('splits integer and decimal parts', () => {
    expect(splitMoney(123450)).toEqual({ integer: '1,234', decimal: '50' });
    expect(splitMoney(5)).toEqual({ integer: '0', decimal: '05' });
  });
});

describe('commission', () => {
  it('computes commission from basis points', () => {
    // 10% of QAR 100.00
    expect(commissionFor(10000, 1000)).toBe(1000);
    // 2.5% of QAR 100.00
    expect(commissionFor(10000, 250)).toBe(250);
  });

  it('rounds to the nearest fil', () => {
    // 3.33% of 100 fils = 3.33 fils -> 3
    expect(commissionFor(100, 333)).toBe(3);
  });

  it('computes the vendor share', () => {
    expect(vendorShareFor(10000, 1000)).toBe(9000);
  });
});

describe('balances', () => {
  it('sums signed ledger entries', () => {
    const entries = [
      { amount_minor: 10000 },
      { amount_minor: -1000 },
      { amount_minor: -250 },
    ];
    expect(balanceFromEntries(entries)).toBe(8750);
  });

  it('treats only exactly zero as redeemed', () => {
    expect(isRedeemed(0)).toBe(true);
    expect(isRedeemed(1)).toBe(false);
    expect(isRedeemed(-1)).toBe(false);
  });
});

describe('assertInteger', () => {
  it('accepts integers and rejects decimals', () => {
    expect(() => assertInteger(100)).not.toThrow();
    expect(() => assertInteger(1.5)).toThrow();
  });
});
