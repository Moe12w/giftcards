// web/lib/bulk.ts
// Shared helpers for bulk offers.
//
// Vendors and enterprise partners both publish bulk offers, and both use the
// same tier format, so the parsing lives in one place.

export interface BulkTier {
  min: number;
  max: number | null;
  priceMinor: number;
}

/**
 * Reads the tier list a vendor typed into the form.
 *
 * One tier per line: "10-49|90", "50+|85", or "10|49|90" (min, max, price).
 */
export function parseBulkTiers(raw: string): BulkTier[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length < 2) return [];
      let min = 0;
      let max: number | null = null;
      const priceRaw = parts[parts.length - 1];
      const range = parts[0];
      if (parts.length === 3) {
        min = Number.parseInt(parts[0], 10) || 0;
        max = parts[1] ? Number.parseInt(parts[1], 10) || null : null;
      } else if (range.includes('-')) {
        const [a, b] = range.split('-').map((x) => x.trim());
        min = Number.parseInt(a, 10) || 0;
        max = b ? Number.parseInt(b, 10) || null : null;
      } else if (range.endsWith('+')) {
        min = Number.parseInt(range.slice(0, -1), 10) || 0;
        max = null;
      } else {
        min = Number.parseInt(range, 10) || 0;
      }
      try {
        const priceMinor = parseMoney(priceRaw);
        if (!priceMinor || priceMinor <= 0 || min <= 0) return [];
        return [{ min, max, priceMinor }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.min - b.min);
}

function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!cleaned) throw new Error('Amount is required');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) throw new Error('Amount is invalid');
  return Math.round(value * 100);
}

/** The unit price for a quantity, taking the best matching tier. */
export function unitPriceForQuantity(
  base: number,
  tiers: Array<{ min_quantity: number; max_quantity: number | null; unit_price_minor: number; sort_order?: number }>,
  qty: number,
): number {
  const sorted = [...tiers].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.min_quantity - b.min_quantity,
  );
  let price = base;
  for (const tier of sorted) {
    const maxOk = tier.max_quantity == null || qty <= tier.max_quantity;
    if (qty >= tier.min_quantity && maxOk) price = tier.unit_price_minor;
  }
  return price;
}

/** Turns tier rows back into the text the form uses. */
export function tiersToText(
  tiers: Array<{ min_quantity: number; max_quantity: number | null; unit_price_minor: number; sort_order?: number }> | null | undefined,
): string {
  return [...(tiers ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.min_quantity - b.min_quantity)
    .map((tier) => `${tier.min_quantity}${tier.max_quantity ? `-${tier.max_quantity}` : '+'}|${(Number(tier.unit_price_minor) / 100).toFixed(2)}`)
    .join('\n');
}

export interface RecipientRow {
  name: string;
  email: string;
  message: string;
}

/**
 * Reads a pasted CSV (or uploaded file) into recipient rows.
 *
 * Accepts "name,email" and "name,email,message" rows, with or without a
 * header line. Extra columns are ignored.
 */
export function parseRecipientRows(raw: string): { rows: RecipientRow[]; invalid: number } {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: RecipientRow[] = [];
  let invalid = 0;

  lines.forEach((line, index) => {
    const cells = line.split(/[,;\t]/).map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const emailCell = (cells[1] ?? '').toLowerCase();
    const nameCell = cells[0] ?? '';

    // Skip a header row.
    if (index === 0 && !emailCell.includes('@')) return;

    if (!emailCell.includes('@')) {
      invalid += 1;
      return;
    }

    rows.push({
      name: nameCell,
      email: emailCell,
      message: cells[2] ?? '',
    });
  });

  return { rows, invalid };
}
