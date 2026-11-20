import { ShoppingBag, Ticket, Wallet } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

export default async function VendorBulkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();

  const { data: orders, error } = await ctx.supabase
    .from('bulk_orders')
    .select('*, business_accounts(id,company_name), bulk_offers(id,title)')
    .eq('vendor_id', ctx.vendor.id)
    .order('created_at', { ascending: false })
    .limit(500);

  const rows = orders ?? [];
  const paid = rows.filter((o: any) => o.payment_status === 'paid');
  const collected = paid.reduce((sum: number, o: any) => sum + Number(o.total_paid_minor ?? 0), 0);
  const payable = paid.reduce((sum: number, o: any) => sum + Number(o.vendor_payable_minor ?? 0), 0);
  const cards = paid.reduce((sum: number, o: any) => sum + Number(o.quantity ?? 0), 0);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Bulk orders"
        title="Corporate bulk orders"
        description="Orders placed by approved business buyers on your bulk offers, with the cards issued and your share of the money."
      />
      <Notice error={params.error ?? error?.message} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon"><ShoppingBag size={17} /></span>
          <strong>{rows.length}</strong>
          <span>Bulk orders</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}><Wallet size={17} /></span>
          <strong>{formatMoney(collected)}</strong>
          <span>Collected</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}><Wallet size={17} /></span>
          <strong>{formatMoney(payable)}</strong>
          <span>Your share</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}><Ticket size={17} /></span>
          <strong>{cards}</strong>
          <span>Gift cards sold</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No bulk orders yet"
          body="When a business buyer orders one of your bulk offers, the order appears here."
        />
      ) : (
        <section className="panel">
          <div className="panel-head"><h3>{rows.length} bulk orders</h3></div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order ref</th>
                    <th>Business</th>
                    <th>Offer</th>
                    <th className="num">Qty</th>
                    <th className="num">Face value</th>
                    <th className="num">Collected</th>
                    <th className="num">Your share</th>
                    <th>Status</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o: any) => (
                    <tr key={o.id}>
                      <td><span className="strong">{o.order_ref}</span></td>
                      <td className="small">{o.business_accounts?.company_name ?? '—'}</td>
                      <td className="small">{o.bulk_offers?.title ?? '—'}</td>
                      <td className="num">{o.quantity}</td>
                      <td className="num">{formatMoney(o.total_face_value_minor)}</td>
                      <td className="num strong">{formatMoney(o.total_paid_minor)}</td>
                      <td className="num">{formatMoney(o.vendor_payable_minor)}</td>
                      <td><StatusTag status={o.status} /></td>
                      <td className="small muted">{formatDate(o.created_at)}</td>
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
