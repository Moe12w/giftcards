'use client';

import { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/money';

type Tier = { min_quantity: number; max_quantity: number | null; unit_price_minor: number; sort_order?: number };

function unitPriceForQuantity(base: number, tiers: Tier[], qty: number): number {
  const sorted = [...tiers].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.min_quantity - b.min_quantity);
  let price = base;
  for (const t of sorted) {
    const maxOk = t.max_quantity == null || qty <= t.max_quantity;
    if (qty >= t.min_quantity && maxOk) price = t.unit_price_minor;
  }
  return price;
}

export function BulkOfferPurchase({
  offerId,
  baseUnitPriceMinor,
  faceValueMinor,
  minQuantity,
  maxQuantity,
  availableQuantity,
  tiers,
  action,
  currency = 'QAR',
}: {
  offerId: string;
  baseUnitPriceMinor: number;
  faceValueMinor: number;
  minQuantity: number;
  maxQuantity: number | null;
  availableQuantity: number | null;
  tiers: Tier[];
  action: (formData: FormData) => void | Promise<void>;
  currency?: string;
}) {
  const initial = Math.max(minQuantity || 1, 1);
  const [qty, setQty] = useState(initial);

  const calc = useMemo(() => {
    const unit = unitPriceForQuantity(baseUnitPriceMinor, tiers, qty);
    const total = unit * qty;
    const faceTotal = faceValueMinor * qty;
    const savings = Math.max(0, faceTotal - total);
    const savingsPct = faceTotal > 0 ? Math.round((savings / faceTotal) * 100) : 0;
    return { unit, total, faceTotal, savings, savingsPct };
  }, [baseUnitPriceMinor, faceValueMinor, tiers, qty]);

  const limitMax = [maxQuantity, availableQuantity].filter((v): v is number => v != null && v > 0);
  const hardMax = limitMax.length ? Math.min(...limitMax) : undefined;

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3>Bulk checkout</h3>
      <p className="small muted">Select quantity to see the applied tier price and total automatically.</p>

      <form action={action} className="form" style={{ marginTop: 12 }}>
        <input type="hidden" name="offer_id" value={offerId} />
        <div className="field">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={minQuantity}
            max={hardMax}
            value={qty}
            onChange={(e) => setQty(Math.max(minQuantity, Number.parseInt(e.target.value || '0', 10) || minQuantity))}
            required
          />
          <span className="hint">Minimum {minQuantity}{hardMax ? ` · Maximum ${hardMax}` : ''}. One gift card/voucher will be issued per unit.</span>
        </div>

        <div className="split-list" style={{ marginTop: 8 }}>
          <div><span className="k">Face value per card</span><span className="v">{formatMoney(faceValueMinor)}</span></div>
          <div><span className="k">Applied bulk price per card</span><span className="v strong">{formatMoney(calc.unit)}</span></div>
          <div><span className="k">Total face value</span><span className="v">{formatMoney(calc.faceTotal)}</span></div>
          <div><span className="k">Total amount to pay</span><span className="v strong" style={{ fontSize: '1.1rem' }}>{formatMoney(calc.total)}</span></div>
          <div><span className="k">You save</span><span className="v">{formatMoney(calc.savings)} {calc.savingsPct > 0 ? `(${calc.savingsPct}%)` : ''}</span></div>
        </div>

        <div className="callout info" style={{ marginTop: 12 }}>
          Pricing is calculated server-side and the agreed unit price/tier is stored on the order at purchase time. Future vendor price changes will not affect this order.
        </div>

        <button className="btn primary block" type="submit" style={{ marginTop: 12 }}>
          Place bulk order ({qty} {qty === 1 ? 'card' : 'cards'})
        </button>
        <p className="small muted" style={{ marginTop: 8 }}>Order will be created with full accounting breakdown (face value, amount paid, discount, platform fee, vendor payable). Payment and voucher issuance are completed through the platform&apos;s fulfilment flow.</p>
      </form>
    </div>
  );
}
