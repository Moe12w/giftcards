import Link from 'next/link';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

export default async function BusinessOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireApprovedBusinessBuyer();

  const { data: orders, error } = await ctx.supabase
    .from('bulk_orders')
    .select('*, vendors(id,name), bulk_offers(id,title)')
    .eq('buyer_user_id', ctx.user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Business portal"
        title="Bulk orders & invoices"
        description="Track your bulk purchases, payment status, pricing snapshots, and distribute purchased gift cards."
      />
      <Notice error={params.error ?? error?.message} />

      {!orders || orders.length === 0 ? (
        <EmptyState
          title="No bulk orders yet"
          body="Browse corporate deals and place a bulk order to see it here."
          action={<Link className="btn primary sm" href="/business">Browse bulk deals</Link>}
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>{orders.length} {orders.length === 1 ? 'order' : 'orders'}</h3>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order ref</th>
                    <th>Vendor / Offer</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit paid</th>
                    <th className="num">Total paid</th>
                    <th className="num">Discount</th>
                    <th>Status</th>
                    <th>Placed</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: any) => (
                    <tr key={o.id}>
                      <td><span className="strong">{o.order_ref}</span></td>
                      <td>
                        <span className="small">{o.vendors?.name ?? '—'}</span><br />
                        <span className="sub">{o.bulk_offers?.title ?? 'Bulk offer'}</span>
                      </td>
                      <td className="num">{o.quantity}</td>
                      <td className="num">{formatMoney(o.unit_price_minor)}</td>
                      <td className="num strong">{formatMoney(o.total_paid_minor)}</td>
                      <td className="num">{formatMoney(o.discount_minor)}</td>
                      <td>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <StatusTag status={o.status} />
                          <span className="sub">Payment: {o.payment_status}</span>
                        </div>
                      </td>
                      <td className="small muted">{formatDate(o.created_at)}</td>
                      <td><div className="row-actions"><Link className="btn sm" href={`/business/orders/${o.id}`}>Open</Link></div></td>
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
