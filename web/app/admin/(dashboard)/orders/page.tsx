import Link from 'next/link';
import { CreditCard, Search, ShoppingBag } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate, initials, titleCase } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
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
        eyebrow="Operations"
        title="Orders"
        description="Every gift order, its payment state and the vouchers it produced."
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Order updated.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <ShoppingBag size={17} />
          </span>
          <strong>{allOrders.length}</strong>
          <span>All orders</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <CreditCard size={17} />
          </span>
          <strong>{formatMoney(paidValue)}</strong>
          <span>{paid.length} paid orders</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{pending}</strong>
          <span>Pending payment</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{refunded}</strong>
          <span>Refunded</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/orders" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Order, buyer or recipient…" aria-label="Search orders" />
        </div>
        <select name="status" defaultValue={status} aria-label="Order status">
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/admin/orders">
            Clear
          </Link>
        ) : null}
      </form>

      {orders.length === 0 ? (
        <EmptyState
          title={q || status ? 'No orders match' : 'No orders yet'}
          body={
            q || status
              ? 'Try a different search or clear the filters.'
              : 'Orders appear here as customers buy gifts in the app.'
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {orders.length} {orders.length === 1 ? 'order' : 'orders'}
            </h3>
            <span className="small muted">Newest first</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Buyer</th>
                    <th>Recipient</th>
                    <th className="num">Items</th>
                    <th className="num">Vouchers</th>
                    <th className="num">Total</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
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
                          <span className="sub">{titleCase(order.delivery_method ?? '—')}</span>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span className="avatar" style={{ width: 28, height: 28, fontSize: '0.64rem' }}>
                              {initials(buyer?.full_name ?? buyer?.email ?? order.sender_name ?? '?')}
                            </span>
                            <span className="small">
                              {buyer?.full_name ?? order.sender_name ?? 'Guest'}
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
                          <span className="tag neutral">{titleCase(order.payment_status ?? '—')}</span>
                        </td>
                        <td className="small muted">{formatDate(order.created_at)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="btn sm" href={`/admin/orders/${order.id}`}>
                              Open
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
