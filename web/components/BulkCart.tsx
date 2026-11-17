'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { unitPriceForQuantity } from '@/lib/bulk';
import { formatMoney } from '@/lib/money';

export interface BulkCartOffer {
  id: string;
  title: string;
  vendorName: string;
  faceValueMinor: number;
  baseUnitPriceMinor: number;
  minQuantity: number;
  maxQuantity: number | null;
  availableQuantity: number | null;
  supplierReady: boolean;
  tiers: Array<{
    min_quantity: number;
    max_quantity: number | null;
    unit_price_minor: number;
    sort_order?: number;
  }>;
}

interface Line {
  offerId: string;
  quantity: number;
}

const ERROR_COPY: Record<string, string> = {
  supplier_not_ready: 'One of these vendors is not ready to accept payments yet. Remove that gift and try again.',
  buyer_not_approved: 'Your business account is not approved for bulk buying.',
  offer_unavailable: 'One of these offers is no longer available. Refresh the page.',
  insufficient_quantity: 'There are not enough cards left for the quantity you chose.',
  invalid_quantity: 'Check the quantity you entered.',
  partner_bulk_offers_not_supported_online: 'Online payment is not available yet for partner-issued bulk codes.',
  payment_provider_not_configured: 'Online payments are not configured. Please contact support.',
  payment_provider_error: 'MyFatoorah could not start the payment. Please try again.',
};

export function BulkCart({ offers }: { offers: BulkCartOffer[] }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(offers.map((offer) => [offer.id, offer])), [offers]);
  const selected = lines.filter((line) => line.quantity > 0 && byId.has(line.offerId));
  const totalMinor = selected.reduce((sum, line) => {
    const offer = byId.get(line.offerId)!;
    return sum + unitPriceForQuantity(offer.baseUnitPriceMinor, offer.tiers, line.quantity) * line.quantity;
  }, 0);
  const hasUnready = selected.some((line) => !byId.get(line.offerId)!.supplierReady);

  function update(offerId: string, quantity: number) {
    setError(null);
    setLines((current) => {
      const rest = current.filter((line) => line.offerId !== offerId);
      return quantity > 0 ? [...rest, { offerId, quantity }] : rest;
    });
  }

  async function pay() {
    if (paying || selected.length === 0 || hasUnready) return;
    setPaying(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: invokeError } = await supabase.functions.invoke('create-bulk-payment', {
        body: {
          items: selected.map((line) => ({ offerId: line.offerId, quantity: line.quantity })),
          idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      });
      if (invokeError) throw invokeError;
      const paymentUrl = String((data as any)?.paymentUrl ?? '');
      if (!paymentUrl) throw new Error((data as any)?.error ?? 'payment_link_unavailable');
      window.location.assign(paymentUrl);
    } catch (paymentError) {
      const message = paymentError instanceof Error ? paymentError.message : 'payment_failed';
      setError(ERROR_COPY[message] ?? 'We could not start the payment. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="dash-grid">
      <section className="panel">
        <div className="panel-head">
          <h3>Available bulk gifts</h3>
          <span className="tag neutral">{offers.length}</span>
        </div>
        <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
          {offers.length === 0 ? (
            <p className="small muted">No active bulk offers right now.</p>
          ) : (
            offers.map((offer) => {
              const line = lines.find((item) => item.offerId === offer.id);
              const unit = unitPriceForQuantity(offer.baseUnitPriceMinor, offer.tiers, line?.quantity || 1);
              const max = offer.maxQuantity ?? offer.availableQuantity ?? undefined;
              return (
                <div key={offer.id} className="card flat" style={{ padding: 14, display: 'grid', gap: 8 }}>
                  <div className="split-list">
                    <div>
                      <span className="k">{offer.title}</span>
                      <span className="v small">{offer.vendorName}</span>
                    </div>
                    <div>
                      <span className="k">Price per card</span>
                      <span className="v">{formatMoney(unit)}</span>
                    </div>
                    <div>
                      <span className="k">Face value</span>
                      <span className="v">{formatMoney(offer.faceValueMinor)}</span>
                    </div>
                  </div>
                  {!offer.supplierReady ? (
                    <p className="small muted">Online payments are not enabled for this vendor yet.</p>
                  ) : null}
                  <div className="btn-row">
                    <input
                      type="number"
                      min={offer.minQuantity}
                      max={max}
                      value={line?.quantity ?? ''}
                      placeholder={`Min ${offer.minQuantity}`}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        update(offer.id, Number.isFinite(value) ? value : 0);
                      }}
                      style={{ maxWidth: 120 }}
                      aria-label={`Quantity for ${offer.title}`}
                    />
                    <button
                      className="btn sm"
                      type="button"
                      disabled={!offer.supplierReady}
                      onClick={() => update(offer.id, Math.max(offer.minQuantity, line?.quantity || 0))}
                    >
                      Add to basket
                    </button>
                    {line ? (
                      <button className="btn sm ghost" type="button" onClick={() => update(offer.id, 0)}>
                        <Trash2 size={14} /> Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Basket</h3>
          <span className="tag neutral">{selected.length}</span>
        </div>
        <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
          {selected.length === 0 ? (
            <p className="small muted">Add at least one gift to continue.</p>
          ) : (
            <div className="split-list">
              {selected.map((line) => {
                const offer = byId.get(line.offerId)!;
                const unit = unitPriceForQuantity(offer.baseUnitPriceMinor, offer.tiers, line.quantity);
                return (
                  <div key={line.offerId}>
                    <span className="k">
                      {offer.title} × {line.quantity}
                    </span>
                    <span className="v">{formatMoney(unit * line.quantity)}</span>
                  </div>
                );
              })}
              <div>
                <span className="k strong">Total</span>
                <span className="v strong">{formatMoney(totalMinor)}</span>
              </div>
            </div>
          )}
          {error ? <div className="callout error">{error}</div> : null}
          <div className="btn-row">
            <Link className="btn ghost" href="/business/deals">
              Browse deals
            </Link>
            <button
              className="btn primary"
              type="button"
              disabled={paying || selected.length === 0 || hasUnready}
              onClick={pay}
            >
              {paying ? 'Opening payment…' : 'Pay with MyFatoorah'} <ArrowRight size={15} />
            </button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            You will return here after payment. Your cards are issued automatically and you can then assign recipients
            from the order page.
          </p>
        </div>
      </section>
    </div>
  );
}
