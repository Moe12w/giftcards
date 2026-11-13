import Link from 'next/link';
import { ArrowRight, Building2, Package, Percent, Search, Tag } from 'lucide-react';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead } from '@/components/ui';
import { businessCopy } from '@/lib/i18n/business';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function BusinessDealsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vendor?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireApprovedBusinessBuyer();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(businessCopy, locale);

  const q = (params.q ?? '').trim().toLowerCase();
  const vendorFilter = params.vendor ?? '';

  const { data: offers, error } = await ctx.supabase
    .from('bulk_offers')
    .select('*, vendors(id,name,logo_url,slug), enterprise_partners(id,name,logo_url,slug), products(id,title,fulfilment_type,image_url), bulk_offer_price_tiers(*)')
    .eq('status', 'active')
    .eq('enabled', true)
    .order('created_at', { ascending: false });

  const now = new Date();
  const visible = (offers ?? []).filter((o: any) => {
    if (o.starts_at && new Date(o.starts_at) > now) return false;
    if (o.ends_at && new Date(o.ends_at) < now) return false;
    if (vendorFilter && o.vendor_id !== vendorFilter) return false;
    if (!q) return true;
    return [o.title, o.description, o.vendors?.name, o.products?.title]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const vendorNames = new Map<string, string>();
  for (const offer of offers ?? []) {
    if (offer.vendor_id && offer.vendors?.name) vendorNames.set(offer.vendor_id, offer.vendors.name);
  }

  const sellerName = (offer: any) => offer.vendors?.name ?? (offer as any).enterprise_partners?.name ?? '—';

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.deals.eyebrow}
        title={t.deals.title}
        description={t.deals.description}
      />
      <Notice error={params.error ?? error?.message} />

      <form className="toolbar" action="/business/deals" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder={t.deals.searchPlaceholder} aria-label={t.deals.searchLabel} />
        </div>
        <select name="vendor" defaultValue={vendorFilter} aria-label={t.deals.vendorLabel}>
          <option value="">{t.deals.allVendors}</option>
          {[...vendorNames.entries()].map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <button className="btn sm" type="submit">{t.deals.filter}</button>
        {q || vendorFilter ? (
          <Link className="btn sm ghost" href="/business/deals">{t.deals.clearFilters}</Link>
        ) : null}
      </form>

      {visible.length === 0 ? (
        <EmptyState
          title={q || vendorFilter ? t.deals.emptyTitle : t.deals.emptyAllTitle}
          body={q || vendorFilter ? t.deals.emptyBody : t.deals.emptyAllBody}
        />
      ) : (
        <div className="grid-3" style={{ marginTop: 4 }}>
          {visible.map((offer: any) => {
            const face = Number(offer.face_value_minor);
            const base = Number(offer.base_unit_price_minor);
            const savingsPct = face > 0 ? Math.round(((face - base) / face) * 100) : 0;
            const tiers = (offer.bulk_offer_price_tiers ?? []) as any[];
            const best = tiers.length
              ? Math.min(...tiers.map((x) => Number(x.unit_price_minor)))
              : base;
            const bestPct = face > 0 ? Math.round(((face - best) / face) * 100) : 0;
            return (
              <article className="card" key={offer.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="icon-tile lavender"><Building2 size={18} /></span>
                  <div>
                    <p className="small muted" style={{ margin: 0 }}>{sellerName(offer)}</p>
                    <h3 style={{ margin: 0 }}>{offer.title}</h3>
                  </div>
                </div>

                <p className="small" style={{ margin: 0 }}>
                  {offer.description || offer.products?.title || t.deals.conditions}
                </p>

                <div className="split-list">
                  <div>
                    <span className="k">{t.deals.faceValue}</span>
                    <span className="v">{formatMoney(face)}</span>
                  </div>
                  <div>
                    <span className="k">{t.deals.bulkPrice}</span>
                    <span className="v strong">
                      {formatMoney(base)}
                      {savingsPct > 0 ? (
                        <span className="tag success" style={{ marginInlineStart: 6 }}>
                          <Percent size={12} /> {t.deals.savings.replace('{percent}', String(savingsPct))}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div>
                    <span className="k">{t.deals.minQuantity}</span>
                    <span className="v">{offer.min_quantity}</span>
                  </div>
                  <div>
                    <span className="k">{t.deals.available}</span>
                    <span className="v">{offer.available_quantity ?? '—'}</span>
                  </div>
                  <div>
                    <span className="k">{t.deals.tiers}</span>
                    <span className="v">
                      <Tag size={14} style={{ verticalAlign: '-2px' }} />{' '}
                      {tiers.length ? t.deals.tierCount.replace('{count}', String(tiers.length)) : t.deals.baseOnly}
                      {bestPct > savingsPct ? (
                        <span className="tag success" style={{ marginInlineStart: 6 }}>
                          <Package size={12} /> {t.deals.savings.replace('{percent}', String(bestPct))}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>

                {offer.additional_conditions ? (
                  <p className="small muted" style={{ margin: 0 }}>{offer.additional_conditions}</p>
                ) : null}

                <div className="btn-row" style={{ marginTop: 'auto' }}>
                  <Link className="btn primary sm" href={`/business/offers/${offer.id}`}>
                    {t.deals.viewOffer} <ArrowRight size={15} />
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
