// src/lib/money.ts
// Money is always stored as integers in minor units (fils). QAR 1.00 = 100 fils.
// Never store or compute money as decimals.

export const CURRENCY = 'QAR';
export const MINOR_UNITS_PER_UNIT = 100;

/** Convert a user-entered major amount (e.g. "12.50") to minor units (1250). */
export function toMinorUnits(amount: string | number): number {
  const value = typeof amount === 'number' ? amount : Number(amount.replace(/,/g, '').trim());
  if (!Number.isFinite(value)) {
    throw new Error('Invalid amount');
  }
  return Math.round(value * MINOR_UNITS_PER_UNIT);
}

/** Convert minor units (1250) to a decimal number (12.5). Use only for display. */
export function toMajorUnits(minor: number): number {
  assertInteger(minor);
  return minor / MINOR_UNITS_PER_UNIT;
}

/** Format minor units as "QAR 1,234.50" (English) or "١٬٢٣٤٫٥٠ ر.ق" (Arabic). */
export function formatMoney(minor: number, locale: 'en' | 'ar' = 'en'): string {
  assertInteger(minor);
  const major = Math.abs(minor) / MINOR_UNITS_PER_UNIT;
  const sign = minor < 0 ? '-' : '';

  if (locale === 'ar') {
    const formatted = new Intl.NumberFormat('ar-QA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
    return `${sign}${formatted} ر.ق`;
  }

  const formatted = new Intl.NumberFormat('en-QA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
  return `${sign}QAR ${formatted}`;
}

/** Split a minor-unit amount into an integer part and two-digit decimal part. */
export function splitMoney(minor: number): { integer: string; decimal: string } {
  assertInteger(minor);
  const abs = Math.abs(minor);
  const integer = Math.floor(abs / MINOR_UNITS_PER_UNIT).toLocaleString('en-QA');
  const decimal = String(abs % MINOR_UNITS_PER_UNIT).padStart(2, '0');
  return { integer, decimal };
}

/** Commission in minor units for a sale, rounded to the nearest fil. */
export function commissionFor(saleMinor: number, rateBps: number): number {
  assertInteger(saleMinor);
  assertInteger(rateBps);
  return Math.round((saleMinor * rateBps) / 10_000);
}

/** Vendor share after commission. */
export function vendorShareFor(saleMinor: number, rateBps: number): number {
  return saleMinor - commissionFor(saleMinor, rateBps);
}

/** Sum ledger entries (signed minor units) into a balance. */
export function balanceFromEntries(entries: Array<{ amount_minor: number }>): number {
  return entries.reduce((sum, e) => sum + e.amount_minor, 0);
}

/** A card is redeemed only when its balance is exactly zero. */
export function isRedeemed(balanceMinor: number): boolean {
  return balanceMinor === 0;
}

export function assertInteger(value: number): void {
  if (!Number.isInteger(value)) {
    throw new Error('Money values must be integers in minor units');
  }
}
