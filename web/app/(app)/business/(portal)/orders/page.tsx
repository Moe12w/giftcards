import Link from 'next/link';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { businessCopy } from '@/lib/i18n/business';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function BusinessOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireApprovedBusinessBuyer();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(businessCopy, locale);

  const { data: orders, error } = await ctx.supabase
    .from('bulk_orders')
    .select('*, vendors(id,name), bulk_offers(id,title)')
    .eq('buyer_user_id', ctx.user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="dash-content">
      <PageHead eyebrow={t.orders.eyebrow} title={t.orders.title} description={t.orders.description} />
      <Notice error={params.error ?? error?.message} />

      {!orders || orders.length === 0 ? (
        <EmptyState
          title={t.orders.emptyTitle}
          body={t.orders.emptyBody}
          action={<Link className="btn primary sm" href="/business/deals">{t.orders.browseDeals}</Link>}
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>{t.orders.orderCount.replace('{count}', String(orders.length))}</h3>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.orders.ref}</th>
                    <th>{t.orders.vendorOffer}</th>
                    <th className="num">{t.orders.quantity}</th>
                    <th className="num">{t.orders.unitPaid}</th>
                    <th className="num">{t.orders.totalPaid}</th>
                    <th className="num">{t.orders.discount}</th>
                    <th>{t.orders.status}</th>
                    <th>{t.orders.placed}</th>
                    <th style={{ textAlign: 'right' }}>{t.orders.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: any) => (
                    <tr key={o.id}>
                      <td><span className="strong">{o.order_ref}</span></td>
                      <td>
                        <span className="small">{o.vendors?.name ?? '—'}</span><br />
                        <span className="sub">{o.bulk_offers?.title ?? '—'}</span>
                      </td>
                      <td className="num">{o.quantity}</td>
                      <td className="num">{formatMoney(o.unit_price_minor)}</td>
                      <td className="num strong">{formatMoney(o.total_paid_minor)}</td>
                      <td className="num">{formatMoney(o.discount_minor)}</td>
                      <td>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <StatusTag status={o.status} />
                          <span className="sub">{t.orders.payment}: {o.payment_status}</span>
                        </div>
                      </td>
                      <td className="small muted">{formatDate(o.created_at, locale)}</td>
                      <td>
                        <div className="row-actions">
                          <Link className="btn sm" href={`/business/orders/${o.id}`}>{t.orders.open}</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
