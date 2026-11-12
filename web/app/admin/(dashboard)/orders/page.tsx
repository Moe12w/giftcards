import Link from 'next/link';
import { CreditCard, Search, ShoppingBag } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate, initials, titleCase } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).orders;
  const c = pick(common, locale);
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';

  const { data, error } = await ctx.supabase
    .from('orders')
    .select(
      'id, order_ref, status, payment_status, subtotal_minor, discount_minor, fee_minor, total_minor, sender_name, recipient_name, delivery_method, paid_at, created_at, profiles(full_name, email), order_items(id), vouchers(id)',
    )
    .order('created_at', { ascending: false })
    .limit(1000);

  const orders = (data ?? []).filter((order) => {
    if (status && order.status !== status) return false;
    if (!q) return true;
    const buyer = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
    return [order.order_ref, order.sender_name, order.recipient_name, buyer?.full_name, buyer?.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const allOrders = data ?? [];
  const paid = allOrders.filter((order) => order.status === 'paid');
  const paidValue = paid.reduce((sum, order) => sum + Number(order.total_minor ?? 0), 0);
  const pending = allOrders.filter((order) => order.status === 'pending').length;
  const refunded = allOrders.filter((order) => order.status === 'refunded').length;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? t.saved : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <ShoppingBag size={17} />
          </span>
          <strong>{allOrders.length}</strong>
          <span>{t.allOrders}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <CreditCard size={17} />
          </span>
          <strong>{formatMoney(paidValue)}</strong>
          <span>{fill(t.paidOrders, { count: paid.length })}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{pending}</strong>
          <span>{t.pendingPayment}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{refunded}</strong>
          <span>{t.refunded}</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/orders" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder={t.searchPlaceholder} aria-label={t.searchLabel} />
        </div>
        <select name="status" defaultValue={status} aria-label={t.statusLabel}>
          <option value="">{t.allStatuses}</option>
          <option value="paid">{c.status.paid}</option>
          <option value="pending">{c.status.pending}</option>
          <option value="failed">{c.status.failed}</option>
          <option value="refunded">{t.refunded}</option>
          <option value="cancelled">{c.status.cancelled}</option>
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/admin/orders">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      {orders.length === 0 ? (
        <EmptyState
          title={q || status ? t.noOrdersMatch : t.noOrdersYet}
          body={
            q || status
              ? t.tryDifferentSearch
              : t.emptyBody
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {fill(orders.length === 1 ? t.orderCountOne : t.orderCount, { count: orders.length })}
            </h3>
            <span className="small muted">{t.newestFirst}</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.order}</th>
                    <th>{t.buyer}</th>
                    <th>{t.recipient}</th>
                    <th className="num">{t.items}</th>
                    <th className="num">{t.vouchers}</th>
                    <th className="num">{c.labels.total}</th>
                    <th>{c.labels.status}</th>
                    <th>{t.payment}</th>
                    <th>{c.labels.date}</th>
                    <th style={{ textAlign: 'right' }}>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const buyer = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
                    const itemCount = Array.isArray(order.order_items) ? order.order_items.length : 0;
                    const voucherCount = Array.isArray(order.vouchers) ? order.vouchers.length : 0;
                    return (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/admin/orders/${order.id}`} className="strong">
                            {order.order_ref}
                          </Link>
                          <br />
                          <span className="sub">{titleCase(order.delivery_method ?? '—', locale)}</span>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span className="avatar" style={{ width: 28, height: 28, fontSize: '0.64rem' }}>
                              {initials(buyer?.full_name ?? buyer?.email ?? order.sender_name ?? '?')}
                            </span>
                            <span className="small">
                              {buyer?.full_name ?? order.sender_name ?? t.guest}
                              <br />
                              <span className="sub">{buyer?.email ?? '—'}</span>
                            </span>
                          </span>
                        </td>
                        <td className="small">{order.recipient_name ?? '—'}</td>
                        <td className="num">{itemCount}</td>
                        <td className="num">{voucherCount}</td>
                        <td className="num strong">{formatMoney(Number(order.total_minor ?? 0))}</td>
                        <td>
                          <StatusTag status={order.status} />
                        </td>
                        <td>
                          <span className="tag neutral">{titleCase(order.payment_status ?? '—', locale)}</span>
                        </td>
                        <td className="small muted">{formatDate(order.created_at, locale)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="btn sm" href={`/admin/orders/${order.id}`}>
                              {c.actions.open}
                            </Link>
                          </div>
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
