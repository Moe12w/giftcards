import Link from 'next/link';
import { ArrowRight, Building2, FileSpreadsheet, ShoppingBag, Upload } from 'lucide-react';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { businessCopy } from '@/lib/i18n/business';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function BusinessDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireApprovedBusinessBuyer();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(businessCopy, locale);

  const [offersResult, ordersResult, allocationsResult] = await Promise.all([
    ctx.supabase
      .from('bulk_offers')
      .select('id, title, vendors(name), base_unit_price_minor, face_value_minor, min_quantity')
      .eq('status', 'active')
      .eq('enabled', true),
    ctx.supabase
      .from('bulk_orders')
      .select('id, order_ref, quantity, total_paid_minor, status, payment_status, created_at, vendors(name), bulk_offers(title)')
      .eq('buyer_user_id', ctx.user.id)
      .order('created_at', { ascending: false }),
    ctx.supabase
      .from('bulk_order_vouchers')
      .select('id, bulk_order_id, delivery_status, voucher_id'),
  ]);

  const offers = offersResult.data ?? [];
  const orders = ordersResult.data ?? [];
  const allocations = allocationsResult.data ?? [];
  const myOrderIds = new Set(orders.map((o: any) => o.id));
  const myAllocations = allocations.filter((a: any) => myOrderIds.has(a.bulk_order_id));

  const issued = myAllocations.filter((a: any) => a.voucher_id).length;
  const sent = myAllocations.filter((a: any) => a.delivery_status === 'sent').length;
  const totalPaid = orders.reduce((sum: number, o: any) => sum + Number(o.total_paid_minor ?? 0), 0);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.dashboard.eyebrow}
        title={t.dashboard.title.replace('{company}', ctx.account.company_name || t.dashboard.titleFallback)}
        description={t.dashboard.description}
        actions={
          <Link className="btn primary sm" href="/business/deals">
            {t.dashboard.browseDeals} <ArrowRight size={15} />
          </Link>
        }
      />
      <Notice error={params.error} success={params.saved === '1' ? t.dashboard.saved : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}><Building2 size={17} /></span>
          <strong>{offers.length}</strong>
          <span>{t.dashboard.kpiDeals}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}><ShoppingBag size={17} /></span>
          <strong>{orders.length}</strong>
          <span>{t.dashboard.kpiOrders}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}><FileSpreadsheet size={17} /></span>
          <strong>{issued}</strong>
          <span>{t.dashboard.kpiCards}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}><Upload size={17} /></span>
          <strong>{sent}</strong>
          <span>{t.order.deliveryStatus}</span>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h3>{t.dashboard.quickActions}</h3></div>
        <div className="panel-body">
          <div className="grid-3">
            <article className="card" style={{ display: 'grid', gap: 10 }}>
              <span className="icon-tile lavender"><Building2 size={20} /></span>
              <h3 style={{ margin: 0 }}>{t.dashboard.browseDeals}</h3>
              <p className="small muted" style={{ margin: 0 }}>{t.dashboard.browseDealsBody}</p>
              <Link className="btn sm primary" href="/business/deals">{t.deals.viewOffer} <ArrowRight size={14} /></Link>
            </article>
            <article className="card" style={{ display: 'grid', gap: 10 }}>
              <span className="icon-tile mint"><Upload size={20} /></span>
              <h3 style={{ margin: 0 }}>{t.dashboard.uploadRecipients}</h3>
              <p className="small muted" style={{ margin: 0 }}>{t.dashboard.uploadRecipientsBody}</p>
              <Link className="btn sm" href="/business/orders">{t.order.uploadCsv}</Link>
            </article>
            <article className="card" style={{ display: 'grid', gap: 10 }}>
              <span className="icon-tile coral"><FileSpreadsheet size={20} /></span>
              <h3 style={{ margin: 0 }}>{t.dashboard.viewOrders}</h3>
              <p className="small muted" style={{ margin: 0 }}>{t.dashboard.viewOrdersBody}</p>
              <Link className="btn sm" href="/business/orders">{t.dashboard.allOrders}</Link>
            </article>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h3>{t.dashboard.recentOrders}</h3>
          <Link className="btn sm ghost" href="/business/orders">{t.dashboard.allOrders}</Link>
        </div>
        <div className="panel-body flush">
          {orders.length === 0 ? (
            <EmptyState title={t.dashboard.noOrders} body="" action={<Link className="btn primary sm" href="/business/deals">{t.deals.viewOffer}</Link>} />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.orders.ref}</th>
                    <th>{t.orders.vendorOffer}</th>
                    <th className="num">{t.orders.quantity}</th>
                    <th className="num">{t.orders.totalPaid}</th>
                    <th>{t.orders.status}</th>
                    <th>{t.orders.placed}</th>
                    <th style={{ textAlign: 'right' }}>{t.orders.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 6).map((o: any) => (
                    <tr key={o.id}>
                      <td><span className="strong">{o.order_ref}</span></td>
                      <td>
                        <span className="small">{o.vendors?.name ?? '—'}</span><br />
                        <span className="sub">{o.bulk_offers?.title ?? ''}</span>
                      </td>
                      <td className="num">{o.quantity}</td>
                      <td className="num strong">{formatMoney(o.total_paid_minor)}</td>
                      <td><StatusTag status={o.status} /></td>
                      <td className="small muted">{formatDate(o.created_at, locale)}</td>
                      <td><div className="row-actions"><Link className="btn sm" href={`/business/orders/${o.id}`}>{t.orders.open}</Link></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <p className="small muted" style={{ marginTop: 16 }}>{t.order.accountingNote}</p>
    </div>
  );
}
