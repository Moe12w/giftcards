import Link from 'next/link';
import { Search, ShoppingBag } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

export default async function VendorOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';

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
        eyebrow="Sales"
        title="Orders"
        description="Every order that includes one of your gifts. Commission and your share are calculated per item."
        actions={
          <Link className="btn sm" href="/vendor/analytics">
            Open analytics
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
          <span>Paid order items</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{formatMoney(gross)}</strong>
          <span>Gross sales</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{formatMoney(share)}</strong>
          <span>Your share</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{formatMoney(gross - share)}</strong>
          <span>Platform commission</span>
        </div>
      </div>

      <form className="toolbar" action="/vendor/orders" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Order, customer or gift…" aria-label="Search orders" />
        </div>
        <select name="status" defaultValue={status} aria-label="Order status">
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/vendor/orders">
            Clear
          </Link>
        ) : null}
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={q || status ? 'No orders match' : 'No orders yet'}
          body={
            q || status
              ? 'Try a different search or clear the status filter.'
              : 'When someone buys one of your gifts, the order appears here with commission and your share.'
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>{items.length} order items</h3>
            <span className="small muted">Newest first</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Gift</th>
                    <th>Recipient</th>
                    <th className="num">Total</th>
                    <th className="num">Commission</th>
                    <th className="num">Your share</th>
                    <th>Status</th>
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
                        <td className="small muted">{formatDate(item.created_at)}</td>
                        <td>{product?.title ?? 'Gift'}</td>
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
