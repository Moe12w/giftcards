import Link from 'next/link';
import { ArrowRight, Building2, Percent, Tag } from 'lucide-react';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead } from '@/components/ui';

export default async function BusinessBulkDealsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireApprovedBusinessBuyer();

  const { data: offers, error } = await ctx.supabase
    .from('bulk_offers')
    .select('*, vendors(id,name,logo_url,slug), products(id,title,fulfilment_type), bulk_offer_price_tiers(*)')
    .eq('status', 'active')
    .eq('enabled', true)
    .order('created_at', { ascending: false });

  const now = new Date();
  const visible = (offers ?? []).filter((o: any) => {
    if (o.starts_at && new Date(o.starts_at) > now) return false;
    if (o.ends_at && new Date(o.ends_at) < now) return false;
    return true;
  });

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Corporate deals"
        title="Exclusive bulk gift card offers"
        description="These prices and offers are available only to approved business/bulk buyer accounts. Select an offer to configure quantity, view tier pricing and place a bulk order."
      />
      <Notice error={params.error ?? error?.message} />

      {visible.length === 0 ? (
        <EmptyState
          title="No bulk deals available yet"
          body="Vendors have not published active bulk offers right now. Check back soon for exclusive corporate pricing."
        />
      ) : (
        <div className="grid-3">
          {visible.map((offer: any) => {
            const face = Number(offer.face_value_minor);
            const base = Number(offer.base_unit_price_minor);
            const savingsPct = face > 0 ? Math.round(((face - base) / face) * 100) : 0;
            const tiers = (offer.bulk_offer_price_tiers ?? []) as any[];
            return (
              <article className="card" key={offer.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="icon-tile mint"><Building2 size={18} /></span>
                  <div>
                    <p className="small muted" style={{ margin: 0 }}>{offer.vendors?.name ?? 'Vendor'}</p>
                    <h3 style={{ margin: 0 }}>{offer.title}</h3>
                  </div>
                </div>
                <p className="small" style={{ margin: 0 }}>{offer.description || offer.products?.title || 'Bulk gift card offer'}</p>
                <div className="split-list">
                  <div><span className="k">Face value</span><span className="v">{formatMoney(face)}</span></div>
                  <div><span className="k">From (bulk)</span><span className="v">{formatMoney(base)} {savingsPct > 0 ? <span className="tag success" style={{ marginInlineStart: 6 }}><Percent size={12} /> {savingsPct}% off</span> : null}</span></div>
                  <div><span className="k">Min. quantity</span><span className="v">{offer.min_quantity}</span></div>
                  <div><span className="k">Available</span><span className="v">{offer.available_quantity ?? '—'}</span></div>
                  <div><span className="k">Pricing tiers</span><span className="v"><Tag size={14} style={{ verticalAlign: '-2px' }} /> {tiers.length || 'Base price'}</span></div>
                </div>
                {offer.additional_conditions ? <p className="small muted">{offer.additional_conditions}</p> : null}
                <div className="btn-row" style={{ marginTop: 'auto' }}>
                  <Link className="btn primary sm" href={`/business/offers/${offer.id}`}>
                    View offer <ArrowRight size={15} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
