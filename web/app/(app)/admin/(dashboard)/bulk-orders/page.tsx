import Link from 'next/link';
import { Building2, ShoppingBag, Ticket, Wallet } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { adminFulfilBulkOrder, adminSetBulkOrderStatus } from '@/lib/actions/admin';

export default async function AdminBulkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const statusFilter = params.status ?? '';

  const { data: orders, error } = await ctx.supabase
    .from('bulk_orders')
    .select('*, vendors(id,name), business_accounts(id,company_name,business_email), bulk_offers(id,title)')
    .order('created_at', { ascending: false })
    .limit(500);

  const rows = (orders ?? []).filter((o: any) => !statusFilter || o.status === statusFilter);

  const paid = (orders ?? []).filter((o: any) => o.payment_status === 'paid');
  const volume = paid.reduce((sum: number, o: any) => sum + Number(o.total_paid_minor ?? 0), 0);
  const faceValue = paid.reduce((sum: number, o: any) => sum + Number(o.total_face_value_minor ?? 0), 0);
  const cards = paid.reduce((sum: number, o: any) => sum + Number(o.quantity ?? 0), 0);
  const awaiting = (orders ?? []).filter((o: any) => o.payment_status !== 'paid' && !['cancelled', 'refunded', 'failed'].includes(o.status));

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Corporate & bulk"
        title="Bulk orders"
        description="Every corporate purchase made through the business portal, its accounting split, and the gift cards issued for it."
      />
      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Saved.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon"><ShoppingBag size={17} /></span>
          <strong>{(orders ?? []).length}</strong>
          <span>Bulk orders</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}><Wallet size={17} /></span>
          <strong>{formatMoney(volume)}</strong>
          <span>Collected</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}><Ticket size={17} /></span>
          <strong>{cards}</strong>
          <span>Gift cards issued</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}><Building2 size={17} /></span>
          <strong>{awaiting.length}</strong>
          <span>Awaiting confirmation</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/bulk-orders" method="get">
        <select name="status" defaultValue={statusFilter} aria-label="Status">
          <option value="">All statuses</option>
          {['pending', 'paid', 'fulfilled', 'partially_fulfilled', 'cancelled', 'refunded', 'failed'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button className="btn sm" type="submit">Filter</button>
        {statusFilter ? <Link className="btn sm ghost" href="/admin/bulk-orders">Clear</Link> : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No bulk orders yet" body="Corporate orders placed through the business portal appear here." />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>{rows.length} bulk orders</h3>
            <span className="small muted">Face value issued: {formatMoney(faceValue)}</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order ref</th>
                    <th>Business</th>
                    <th>Vendor / offer</th>
                    <th className="num">Qty</th>
                    <th className="num">Total paid</th>
                    <th className="num">Face value</th>
                    <th className="num">Fee / payable</th>
                    <th>Status</th>
                    <th>Placed</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o: any) => (
                    <tr key={o.id}>
                      <td><span className="strong">{o.order_ref}</span></td>
                      <td>
                        <span className="small">{o.business_accounts?.company_name ?? '—'}</span><br />
                        <span className="sub">{o.business_accounts?.business_email ?? ''}</span>
                      </td>
                      <td>
                        <span className="small">{o.vendors?.name ?? '—'}</span><br />
                        <span className="sub">{o.bulk_offers?.title ?? ''}</span>
                      </td>
                      <td className="num">{o.quantity}</td>
                      <td className="num strong">{formatMoney(o.total_paid_minor)}</td>
                      <td className="num">{formatMoney(o.total_face_value_minor)}</td>
                      <td className="num">
                        {formatMoney(o.platform_fee_minor)} / {formatMoney(o.vendor_payable_minor)}
                      </td>
                      <td>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <StatusTag status={o.status} />
                          <span className="sub">{o.payment_status}</span>
                        </div>
                      </td>
                      <td className="small muted">{formatDate(o.created_at)}</td>
                      <td>
                        <div className="row-actions" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {o.payment_status !== 'paid' && !['cancelled', 'refunded'].includes(o.status) ? (
                            <form action={adminFulfilBulkOrder}>
                              <input type="hidden" name="order_id" value={o.id} />
                              <button className="btn sm primary" type="submit">Confirm &amp; issue cards</button>
                            </form>
                          ) : null}
                          {['cancelled', 'refunded', 'failed'].includes(o.status) ? null : (
                            <>
                              <form action={adminSetBulkOrderStatus}>
                                <input type="hidden" name="order_id" value={o.id} />
                                <input type="hidden" name="status" value="cancelled" />
                                <button className="btn sm ghost" type="submit">Cancel</button>
                              </form>
                              <form action={adminSetBulkOrderStatus}>
                                <input type="hidden" name="order_id" value={o.id} />
                                <input type="hidden" name="status" value="refunded" />
                                <button className="btn sm ghost" type="submit">Refund</button>
                              </form>
                            </>
                          )}
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
