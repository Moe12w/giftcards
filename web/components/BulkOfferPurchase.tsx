'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { addToBulkBasket } from '@/lib/bulk-basket';
import { formatMoney } from '@/lib/money';

type Tier = { min_quantity: number; max_quantity: number | null; unit_price_minor: number; sort_order?: number };

export interface BulkPurchaseLabels {
  title: string;
  description: string;
  quantity: string;
  quantityHint: string;
  maxHint: string;
  appliedPrice: string;
  totalFace: string;
  totalPay: string;
  youSave: string;
  placeOrder: string;
  payWithMyFatoorah: string;
  addToBasket: string;
  note: string;
  cards: string;
  card: string;
  stockWarning: string;
  giftMessage: string;
}

const EN: BulkPurchaseLabels = {
  title: 'Bulk checkout',
  description: 'Choose a quantity. The tier price and total update automatically.',
  quantity: 'Quantity',
  quantityHint: 'Minimum {min}. One gift card is issued per unit.',
  maxHint: '· Maximum {max}',
  appliedPrice: 'Applied bulk price per card',
  totalFace: 'Total face value',
  totalPay: 'Total amount to pay',
  youSave: 'You save',
  placeOrder: 'Place bulk order',
  payWithMyFatoorah: 'Pay with MyFatoorah',
  addToBasket: 'Add to basket',
  note: 'The agreed unit price and tier are stored on the order, so later price changes never affect it.',
  cards: 'cards',
  card: 'card',
  stockWarning: 'Only {count} cards left on this offer.',
  giftMessage: 'Message for every card (optional)',
};

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

function unitPriceForQuantity(base: number, tiers: Tier[], qty: number): number {
  const sorted = [...tiers].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.min_quantity - b.min_quantity);
  let price = base;
  for (const tier of sorted) {
    const maxOk = tier.max_quantity == null || qty <= tier.max_quantity;
    if (qty >= tier.min_quantity && maxOk) price = tier.unit_price_minor;
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
  currency = 'QAR',
  labels,
}: {
  offerId: string;
  baseUnitPriceMinor: number;
  faceValueMinor: number;
  minQuantity: number;
  maxQuantity: number | null;
  availableQuantity: number | null;
  tiers: Tier[];
  currency?: string;
  labels?: Partial<BulkPurchaseLabels>;
}) {
  const router = useRouter();
  const t: BulkPurchaseLabels = { ...EN, ...(labels ?? {}) };
  const initial = Math.max(minQuantity || 1, 1);
  const [qty, setQty] = useState(initial);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (paying) return;
    setPaying(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: invokeError } = await supabase.functions.invoke('create-bulk-payment', {
        body: {
          items: [{ offerId, quantity: qty }],
          idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      });
      if (invokeError) throw invokeError;
      const paymentUrl = String((data as any)?.paymentUrl ?? '');
      if (!paymentUrl) throw new Error((data as any)?.error ?? 'payment_link_unavailable');
      window.location.assign(paymentUrl);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error && paymentError.message.includes('supplier')
          ? 'This business is not ready to accept payments yet. Try again later.'
          : 'We could not start the payment. Please try again.',
      );
    } finally {
      setPaying(false);
    }
  }

  function addToBasket() {
    addToBulkBasket(offerId, qty);
    router.push('/business/cart');
  }

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
      <h3>{t.title}</h3>
      <p className="small muted">{t.description}</p>

      <div className="form" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="quantity">{t.quantity}</label>
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
          <span className="hint">
            {fill(t.quantityHint, { min: minQuantity, max: '' })}
            {hardMax ? ` ${fill(t.maxHint, { max: hardMax })}` : ''}
          </span>
          {hardMax && availableQuantity != null && availableQuantity <= hardMax ? (
            <span className="hint" style={{ color: 'var(--coral)' }}>
              {fill(t.stockWarning, { count: availableQuantity })}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="gift_message">{t.giftMessage}</label>
          <textarea id="gift_message" name="gift_message" rows={2} />
        </div>

        <div className="split-list" style={{ marginTop: 8 }}>
          <div><span className="k">{t.appliedPrice}</span><span className="v strong">{formatMoney(calc.unit)}</span></div>
          <div><span className="k">{t.totalFace}</span><span className="v">{formatMoney(calc.faceTotal)}</span></div>
          <div><span className="k">{t.totalPay}</span><span className="v strong" style={{ fontSize: '1.1rem' }}>{formatMoney(calc.total)}</span></div>
          <div><span className="k">{t.youSave}</span><span className="v">{formatMoney(calc.savings)} {calc.savingsPct > 0 ? `(${calc.savingsPct}%)` : ''}</span></div>
        </div>

        <div className="callout info" style={{ marginTop: 12 }}>{t.note}</div>
        {error ? <div className="callout error">{error}</div> : null}

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn primary" type="button" onClick={pay} disabled={paying}>
            {paying ? 'Opening payment…' : `${t.payWithMyFatoorah} (${qty} ${qty === 1 ? t.card : t.cards})`}
          </button>
          <button className="btn ghost" type="button" onClick={addToBasket}>
            {t.addToBasket}
          </button>
        </div>
      </div>
    </div>
  );
}
