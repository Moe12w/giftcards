import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Package } from 'lucide-react';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { Notice, PageHead } from '@/components/ui';
import { createBulkOrder } from '@/lib/actions/business';
import { BulkOfferPurchase } from '@/components/BulkOfferPurchase';
import { businessCopy } from '@/lib/i18n/business';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

function tierLabel(t: any) {
  const range = t.max_quantity ? `${t.min_quantity}–${t.max_quantity}` : `${t.min_quantity}+`;
  return `${range}: ${formatMoney(Number(t.unit_price_minor))}`;
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
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(businessCopy, locale);

  const { data: offer } = await ctx.supabase
    .from('bulk_offers')
    .select('*, vendors(id,name,logo_url,slug), enterprise_partners(id,name,logo_url), products(id,title,fulfilment_type,description,terms_and_conditions), bulk_offer_price_tiers(*)')
    .eq('id', id)
    .eq('status', 'active')
    .eq('enabled', true)
    .maybeSingle();

  if (!offer) notFound();

  const tiers = ((offer.bulk_offer_price_tiers ?? []) as any[]).sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.min_quantity - b.min_quantity,
  );
  const face = Number(offer.face_value_minor);
  const base = Number(offer.base_unit_price_minor);
  const savingsPct = face > 0 ? Math.round(((face - base) / face) * 100) : 0;
  const sellerName = offer.vendors?.name ?? (offer as any).enterprise_partners?.name ?? 'Giftly';

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={sellerName}
        title={offer.title}
        description={offer.description || offer.products?.description || t.deals.description}
        actions={
          <Link className="btn sm ghost" href="/business/deals">
            <ArrowLeft size={15} /> {t.offer.backToDeals}
          </Link>
        }
      />
      <Notice error={sp.error} />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head"><h3>{t.offer.offerDetails}</h3></div>
          <div className="panel-body">
            <div className="split-list">
              <div><span className="k">{t.offer.vendor}</span><span className="v">{sellerName}</span></div>
              <div><span className="k">{t.offer.giftCard}</span><span className="v">{offer.products?.title ?? '—'}</span></div>
              <div><span className="k">{t.offer.faceValue}</span><span className="v">{formatMoney(face)}</span></div>
              <div>
                <span className="k">{t.offer.bulkPrice}</span>
                <span className="v strong">
                  {formatMoney(base)}{' '}
                  {savingsPct > 0 ? <span className="tag success">{t.offer.savings.replace('{percent}', String(savingsPct))}</span> : null}
                </span>
              </div>
              <div><span className="k">{t.offer.minQuantity}</span><span className="v">{offer.min_quantity}</span></div>
              <div><span className="k">{t.offer.maxQuantity}</span><span className="v">{offer.max_quantity ?? t.offer.unlimited}</span></div>
              <div><span className="k">{t.offer.available}</span><span className="v">{offer.available_quantity ?? t.offer.notLimited}</span></div>
              <div><span className="k">{t.offer.delivery}</span><span className="v">{offer.delivered_digitally ? t.offer.digital : t.deals.conditions}</span></div>
              <div>
                <span className="k">{t.offer.offerPeriod}</span>
                <span className="v">
                  <Calendar size={14} style={{ verticalAlign: '-2px' }} />{' '}
                  {offer.starts_at ? new Date(offer.starts_at).toLocaleDateString() : t.offer.now} –{' '}
                  {offer.ends_at ? new Date(offer.ends_at).toLocaleDateString() : t.offer.openEnded}
                </span>
              </div>
              <div><span className="k">{t.offer.giftExpiry}</span><span className="v">{offer.expires_at ? new Date(offer.expires_at).toLocaleDateString() : t.offer.perProduct}</span></div>
            </div>

            {offer.additional_conditions ? (
              <div className="callout" style={{ marginTop: 16 }}>
                <strong>{t.offer.specialConditions}</strong>
                <p style={{ margin: '6px 0 0' }}>{offer.additional_conditions}</p>
              </div>
            ) : null}

            {offer.products?.terms_and_conditions ? (
              <div className="callout info" style={{ marginTop: 12 }}>
                {offer.products.terms_and_conditions}
              </div>
            ) : null}

            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>
                <Package size={16} style={{ verticalAlign: '-2px' }} /> {t.offer.volumePricing}
              </h4>
              {tiers.length === 0 ? (
                <p className="small muted">
                  {t.offer.flatPrice.replace('{price}', formatMoney(base))}
                </p>
              ) : (
                <ul className="check-list" style={{ margin: 0 }}>
                  {tiers.map((tier: any) => <li key={tier.id}>{tierLabel(tier)}</li>)}
                </ul>
              )}
              <p className="small muted" style={{ marginTop: 8 }}>{t.offer.tierNote}</p>
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
          labels={{
            title: t.checkout.title,
            description: t.checkout.description,
            quantity: t.checkout.quantity,
            quantityHint: t.checkout.quantityHint,
            maxHint: t.checkout.maxHint,
            appliedPrice: t.checkout.appliedPrice,
            totalFace: t.checkout.totalFace,
            totalPay: t.checkout.totalPay,
            youSave: t.checkout.youSave,
            placeOrder: t.checkout.placeOrder,
            note: t.checkout.note,
            cards: t.checkout.cards,
            card: t.checkout.card,
            stockWarning: t.checkout.stockWarning,
            giftMessage: t.order.message,
          }}
        />
      </div>
    </div>
  );
}
