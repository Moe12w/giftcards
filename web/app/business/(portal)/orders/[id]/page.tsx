import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { updateBulkOrderAllocations } from '@/lib/actions/business';

export default async function BusinessOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireApprovedBusinessBuyer();

  const { data: order } = await ctx.supabase
    .from('bulk_orders')
    .select('*, vendors(id,name), bulk_offers(id,title), products(id,title)')
    .eq('id', id)
    .eq('buyer_user_id', ctx.user.id)
    .maybeSingle();

  if (!order) notFound();

  const { data: allocations } = await ctx.supabase
    .from('bulk_order_vouchers')
    .select('*')
    .eq('bulk_order_id', order.id)
    .order('created_at', { ascending: true });

  const success = sp.created === '1'
    ? 'Bulk order created. Agreed pricing has been captured on this order.'
    : sp.saved === '1'
      ? 'Recipient distribution saved.'
      : null;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Bulk order"
        title={order.order_ref}
        description={`Placed ${formatDate(order.created_at)} · ${order.vendors?.name ?? 'Vendor'} · ${order.bulk_offers?.title ?? order.products?.title ?? 'Bulk offer'}`}
        actions={
          <div className="btn-row">
            <Link className="btn sm ghost" href="/business/orders"><ArrowLeft size={15} /> Orders</Link>
            <a className="btn sm" href={`/business/orders/${order.id}/export`}><Download size={15} /> Download CSV</a>
          </div>
        }
      />
      <Notice error={sp.error} success={success} />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head"><h3>Order summary</h3><StatusTag status={order.status} /></div>
          <div className="panel-body">
            <div className="split-list">
              <div><span className="k">Order reference</span><span className="v">{order.order_ref}</span></div>
              <div><span className="k">Vendor</span><span className="v">{order.vendors?.name ?? '—'}</span></div>
              <div><span className="k">Product / offer</span><span className="v">{order.bulk_offers?.title ?? order.products?.title ?? '—'}</span></div>
              <div><span className="k">Quantity</span><span className="v">{order.quantity}</span></div>
              <div><span className="k">Face value per gift card</span><span className="v">{formatMoney(order.face_value_minor)}</span></div>
              <div><span className="k">Price paid per gift card</span><span className="v strong">{formatMoney(order.unit_price_minor)}</span></div>
              <div><span className="k">Total face value</span><span className="v">{formatMoney(order.total_face_value_minor)}</span></div>
              <div><span className="k">Total amount paid</span><span className="v strong">{formatMoney(order.total_paid_minor)}</span></div>
              <div><span className="k">Discount received</span><span className="v">{formatMoney(order.discount_minor)}</span></div>
              <div><span className="k">Payment status</span><span className="v">{order.payment_status}</span></div>
              <div><span className="k">Order status</span><span className="v">{order.status}</span></div>
              <div><span className="k">Paid at</span><span className="v">{order.paid_at ? formatDate(order.paid_at) : '—'}</span></div>
            </div>
            <div className="callout info" style={{ marginTop: 16 }}>
              <strong>Accounting (captured at purchase)</strong>
              <div className="split-list" style={{ marginTop: 8 }}>
                <div><span className="k">Platform fee / commission</span><span className="v">{formatMoney(order.platform_fee_minor)}</span></div>
                <div><span className="k">Vendor payable</span><span className="v">{formatMoney(order.vendor_payable_minor)}</span></div>
                <div><span className="k">Face value (redemption value)</span><span className="v">{formatMoney(order.total_face_value_minor)}</span></div>
              </div>
              <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>Face value is kept separate from the discounted amount paid. Gift cards redeem at face value.</p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Invoice / receipt</h3></div>
          <div className="panel-body">
            <p className="small">Invoice for <strong>{order.order_ref}</strong></p>
            <div className="split-list">
              <div><span className="k">Billed company</span><span className="v">{ctx.account.company_name}</span></div>
              <div><span className="k">Contact</span><span className="v">{ctx.account.contact_name} ({ctx.account.business_email})</span></div>
              <div><span className="k">Currency</span><span className="v">{order.currency}</span></div>
              <div><span className="k">Amount due/paid</span><span className="v strong">{formatMoney(order.total_paid_minor)}</span></div>
            </div>
            <a className="btn sm" style={{ marginTop: 12 }} href={`/business/orders/${order.id}/export`}><FileSpreadsheet size={15} /> Download order & gift cards (CSV/Excel)</a>
            <p className="small muted" style={{ marginTop: 8 }}>Includes order details and all allocated gift card entries for distribution.</p>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h3>Gift cards & distribution ({(allocations ?? []).length})</h3></div>
        <div className="panel-body">
          <p className="small muted">Assign each gift card to an employee or recipient. You can download the list as CSV/Excel for bulk distribution. Voucher codes/IDs are populated as cards are issued through fulfilment.</p>
          <form action={updateBulkOrderAllocations} className="form" style={{ marginTop: 12 }}>
            <input type="hidden" name="order_id" value={order.id} />
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Voucher code / ID</th>
                    <th>Recipient name</th>
                    <th>Recipient email</th>
                    <th>Delivery status</th>
                  </tr>
                </thead>
                <tbody>
                  {(allocations ?? []).map((a: any, idx: number) => (
                    <tr key={a.id}>
                      <td>{idx + 1}</td>
                      <td className="small">{a.voucher_code || a.voucher_id || 'Pending issuance'}</td>
                      <td><input name={`recipient_name_${a.id}`} defaultValue={a.recipient_name ?? ''} placeholder="Recipient name" /></td>
                      <td><input name={`recipient_email_${a.id}`} defaultValue={a.recipient_email ?? ''} placeholder="email@company.com" type="email" /></td>
                      <td><StatusTag status={a.delivery_status || 'pending'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn primary" type="submit">Save distribution</button>
              <a className="btn ghost" href={`/business/orders/${order.id}/export`}>Export CSV/Excel</a>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
