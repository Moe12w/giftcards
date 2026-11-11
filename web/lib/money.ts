/** Money is always stored as integer minor units (fils). */
export function formatMoney(minor: number | null | undefined, lang: 'en' | 'ar' = 'en'): string {
  const value = (minor ?? 0) / 100;
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-QA' : 'en-QA', {
    style: 'currency',
    currency: 'QAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Parses "1,234.50" or "1234.5" into 123450 fils. Throws on invalid input. */
export function parseMoneyToMinor(input: string): number {
  const cleaned = input.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!cleaned) throw new Error('Amount is required');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) throw new Error('Amount is invalid');
  return Math.round(value * 100);
}

export function minorToInput(minor: number | null | undefined): string {
  return ((minor ?? 0) / 100).toFixed(2);
}
