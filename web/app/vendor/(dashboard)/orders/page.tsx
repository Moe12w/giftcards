import Link from 'next/link';
import { Search, ShoppingBag } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { fill, pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export default async function VendorOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).orders;
  const c = pick(common, locale);

  const { data, error } = await ctx.supabase
    .from('order_items')
    .select(
      'id, total_minor, commission_minor, vendor_share_minor, created_at, recipient_name, products(title), orders(order_ref, status, created_at, sender_name, recipient_name, recipient_email)',
    )
    .eq('vendor_id', ctx.vendor.id)
    .order('created_at', { ascending: false })
    .limit(400);

  const items = (data ?? []).filter((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    if (status && order?.status !== status) return false;
    if (!q) return true;
    const haystack = [
      order?.order_ref,
      order?.sender_name,
      order?.recipient_name,
      item.recipient_name,
      product?.title,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const paid = (data ?? []).filter((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.status === 'paid';
  });
  const gross = paid.reduce((sum, item) => sum + Number(item.total_minor ?? 0), 0);
  const share = paid.reduce((sum, item) => sum + Number(item.vendor_share_minor ?? 0), 0);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          <Link className="btn sm" href="/vendor/analytics">
            {t.openAnalytics}
          </Link>
        }
      />

      <Notice error={params.error ?? error?.message} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <ShoppingBag size={17} />
          </span>
          <strong>{paid.length}</strong>
          <span>{t.paidOrderItems}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{formatMoney(gross)}</strong>
          <span>{t.grossSales}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{formatMoney(share)}</strong>
          <span>{t.yourShare}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{formatMoney(gross - share)}</strong>
          <span>{t.platformCommission}</span>
        </div>
      </div>

      <form className="toolbar" action="/vendor/orders" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input
            name="q"
            defaultValue={params.q ?? ''}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchLabel}
          />
        </div>
        <select name="status" defaultValue={status} aria-label={t.statusLabel}>
          <option value="">{t.allStatuses}</option>
          <option value="paid">{c.status.paid}</option>
          <option value="pending">{c.status.pending}</option>
          <option value="failed">{c.status.failed}</option>
          <option value="refunded">{t.refunded}</option>
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/vendor/orders">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={q || status ? t.noMatchTitle : t.emptyTitle}
          body={q || status ? t.noMatchBody : t.emptyBody}
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>{fill(t.orderItems, { count: items.length })}</h3>
            <span className="small muted">{t.newestFirst}</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.order}</th>
                    <th>{c.labels.date}</th>
                    <th>{t.gift}</th>
                    <th>{t.recipient}</th>
                    <th className="num">{c.labels.total}</th>
                    <th className="num">{t.commission}</th>
                    <th className="num">{t.yourShare}</th>
                    <th>{c.labels.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
                    const product = Array.isArray(item.products) ? item.products[0] : item.products;
                    return (
                      <tr key={item.id}>
                        <td>
                          <span className="strong">{order?.order_ref ?? '—'}</span>
                          <br />
                          <span className="sub">{order?.sender_name ?? order?.recipient_email ?? ''}</span>
                        </td>
                        <td className="small muted">{formatDate(item.created_at, locale)}</td>
                        <td>{product?.title ?? t.gift}</td>
                        <td>{item.recipient_name ?? order?.recipient_name ?? '—'}</td>
                        <td className="num">{formatMoney(Number(item.total_minor ?? 0))}</td>
                        <td className="num muted">{formatMoney(Number(item.commission_minor ?? 0))}</td>
                        <td className="num strong">{formatMoney(Number(item.vendor_share_minor ?? 0))}</td>
                        <td>
                          <StatusTag status={order?.status ?? 'pending'} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
