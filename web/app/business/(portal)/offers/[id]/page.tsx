import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Package } from 'lucide-react';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { Notice, PageHead } from '@/components/ui';
import { createBulkOrder } from '@/lib/actions/business';
import { BulkOfferPurchase } from '@/components/BulkOfferPurchase';

function tierLabel(t: any) {
  const range = t.max_quantity ? `${t.min_quantity}–${t.max_quantity}` : `${t.min_quantity}+`;
  return `${range}: ${formatMoney(Number(t.unit_price_minor))} per card`;
}

export default async function BusinessOfferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireApprovedBusinessBuyer();

  const { data: offer } = await ctx.supabase
    .from('bulk_offers')
    .select('*, vendors(id,name,logo_url,slug), products(id,title,fulfilment_type,description), bulk_offer_price_tiers(*)')
    .eq('id', id)
    .eq('status', 'active')
    .eq('enabled', true)
    .maybeSingle();

  if (!offer) notFound();

  const tiers = ((offer.bulk_offer_price_tiers ?? []) as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.min_quantity - b.min_quantity);
  const face = Number(offer.face_value_minor);
  const base = Number(offer.base_unit_price_minor);
  const savingsPct = face > 0 ? Math.round(((face - base) / face) * 100) : 0;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={offer.vendors?.name ?? 'Bulk offer'}
        title={offer.title}
        description={offer.description || offer.products?.description || 'Exclusive bulk pricing for approved business accounts.'}
        actions={<Link className="btn sm ghost" href="/business"><ArrowLeft size={15} /> Back to deals</Link>}
      />
      <Notice error={sp.error} />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head"><h3>Offer details</h3></div>
          <div className="panel-body">
            <div className="split-list">
              <div><span className="k">Vendor / brand</span><span className="v">{offer.vendors?.name ?? '—'}</span></div>
              <div><span className="k">Linked gift card</span><span className="v">{offer.products?.title ?? '—'}</span></div>
              <div><span className="k">Face value per card</span><span className="v">{formatMoney(face)}</span></div>
              <div><span className="k">Bulk selling price (from)</span><span className="v">{formatMoney(base)} {savingsPct > 0 ? <span className="tag success">{savingsPct}% savings</span> : null}</span></div>
              <div><span className="k">Minimum purchase quantity</span><span className="v">{offer.min_quantity}</span></div>
              <div><span className="k">Maximum purchase quantity</span><span className="v">{offer.max_quantity ?? 'No limit'}</span></div>
              <div><span className="k">Available quantity</span><span className="v">{offer.available_quantity ?? 'Not limited'}</span></div>
              <div><span className="k">Delivery</span><span className="v">{offer.delivered_digitally ? 'Digital delivery' : 'As specified'}</span></div>
              <div><span className="k">Offer period</span><span className="v"><Calendar size={14} style={{ verticalAlign: '-2px' }} /> {offer.starts_at ? new Date(offer.starts_at).toLocaleDateString() : 'Now'} – {offer.ends_at ? new Date(offer.ends_at).toLocaleDateString() : 'Open-ended'}</span></div>
              <div><span className="k">Gift card expiry</span><span className="v">{offer.expires_at ? new Date(offer.expires_at).toLocaleDateString() : 'Per product terms'}</span></div>
            </div>

            {offer.additional_conditions ? (
              <div className="callout" style={{ marginTop: 16 }}>
                <strong>Special conditions</strong>
                <p style={{ margin: '6px 0 0' }}>{offer.additional_conditions}</p>
              </div>
            ) : null}

            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}><Package size={16} style={{ verticalAlign: '-2px' }} /> Volume pricing</h4>
              {tiers.length === 0 ? (
                <p className="small muted">Flat bulk price: {formatMoney(base)} per card for all eligible quantities.</p>
              ) : (
                <ul className="check-list" style={{ margin: 0 }}>
                  {tiers.map((t: any) => <li key={t.id}>{tierLabel(t)}</li>)}
                </ul>
              )}
              <p className="small muted" style={{ marginTop: 8 }}>The correct price tier is applied automatically based on your selected quantity.</p>
            </div>
          </div>
        </section>

        <BulkOfferPurchase
          offerId={offer.id}
          baseUnitPriceMinor={base}
          faceValueMinor={face}
          minQuantity={offer.min_quantity || 1}
          maxQuantity={offer.max_quantity}
          availableQuantity={offer.available_quantity}
          tiers={tiers}
          action={createBulkOrder}
          currency={offer.currency || 'QAR'}
        />
      </div>
    </div>
  );
}
