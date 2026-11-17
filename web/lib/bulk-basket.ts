export interface BasketLine {
  offerId: string;
  quantity: number;
}

const KEY = 'giftly.bulk-basket';

/** Client-side basket shared between the offer page and the checkout page. */
export function readBulkBasket(): BasketLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((line: any) => typeof line?.offerId === 'string' && Number.isFinite(line?.quantity))
      .map((line: any) => ({ offerId: line.offerId, quantity: Math.max(1, Math.floor(Number(line.quantity))) }));
  } catch {
    return [];
  }
}

export function writeBulkBasket(lines: BasketLine[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
    window.dispatchEvent(new CustomEvent('giftly:basket', { detail: lines }));
  } catch {
    // Private mode: the basket stays in memory for this page only.
  }
}

export function addToBulkBasket(offerId: string, quantity: number): BasketLine[] {
  const lines = readBulkBasket();
  const existing = lines.find((line) => line.offerId === offerId);
  if (existing) existing.quantity += quantity;
  else lines.push({ offerId, quantity });
  writeBulkBasket(lines);
  return lines;
}

export function removeFromBulkBasket(offerId: string): BasketLine[] {
  const lines = readBulkBasket().filter((line) => line.offerId !== offerId);
  writeBulkBasket(lines);
  return lines;
}
