import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  CreditCard,
  Mail,
  MessageSquare,
  Package,
  Phone,
  ScanLine,
  ShoppingBag,
  Ticket,
  Truck,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminSetOrderStatus } from '@/lib/actions/admin';
import { formatDate, formatDateTime, titleCase } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { fulfilmentLabel } from '@/lib/catalog';
import { Notice, PageHead, StatusTag } from '@/components/ui';

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await requireAdmin();
  const supabase = ctx.supabase;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, profiles(full_name, email, phone)')
    .eq('id', id)
    .maybeSingle();
  if (!order) notFound();

  const [itemsResult, vouchersResult] = await Promise.all([
    supabase
      .from('order_items')
      .select(
        'id, quantity, unit_price_minor, total_minor, commission_minor, vendor_share_minor, currency, recipient_name, recipient_email, recipient_phone, delivery_method, created_at, products(id, title, slug, fulfilment_type, vendors(name)), product_variants(label, session_count)',
      )
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('vouchers')
      .select('id, voucher_code, status, fulfilment_type, initial_value_minor, remaining_value_minor, total_sessions, remaining_sessions, recipient_name, recipient_email, expires_at, created_at, products(title)')
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
  ]);

  const error = orderError ?? itemsResult.error ?? null;

  const items = itemsResult.data ?? [];
  const vouchers = vouchersResult.data ?? [];
  const voucherIds = vouchers.map((voucher) => voucher.id);

  const { data: redemptions } = voucherIds.length
    ? await supabase
        .from('redemptions')
        .select('id, reference, voucher_id, kind, amount_minor, sessions, status, service_label, occurred_at')
        .in('voucher_id', voucherIds)
        .order('occurred_at', { ascending: false })
    : { data: [] };

  const buyer = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity ?? 1), 0);

  return (
    <div className="dash-content">
      <Link className="back-link" href="/admin/orders">
        <ArrowLeft size={15} /> Back to orders
      </Link>

      <PageHead
        eyebrow="Order"
        title={order.order_ref}
        description={`${formatDateTime(order.created_at)} · ${itemCount} ${itemCount === 1 ? 'item' : 'items'} · ${vouchers.length} ${vouchers.length === 1 ? 'voucher' : 'vouchers'}`}
        actions={
          <>
            <StatusTag status={order.status} />
            <span className="tag neutral">{titleCase(order.payment_status ?? '—')}</span>
          </>
        }
      />

      <Notice error={query.error ?? error?.message} success={query.saved === '1' ? 'Order updated.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <CreditCard size={17} />
          </span>
          <strong>{formatMoney(Number(order.total_minor ?? 0))}</strong>
          <span>Order total</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{formatMoney(Number(order.subtotal_minor ?? 0))}</strong>
          <span>Subtotal</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{formatMoney(Number(order.discount_minor ?? 0))}</strong>
          <span>Discount</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Truck size={17} />
          </span>
          <strong>{titleCase(order.delivery_method ?? '—')}</strong>
          <span>{order.scheduled_for ? formatDateTime(order.scheduled_for) : 'Immediate delivery'}</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Buyer & recipient</h3>
            <Mail size={16} />
          </div>
          <div className="panel-body">
            <div className="split-list">
              <div>
                <span className="k">Buyer</span>
                <span className="v">
                  {buyer?.full_name ?? order.sender_name ?? 'Guest'}
                  {buyer?.email ? <span className="small muted"> · {buyer.email}</span> : null}
                </span>
              </div>
              <div>
                <span className="k">
                  <Phone size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Buyer phone
                </span>
                <span className="v small">{buyer?.phone ?? '—'}</span>
              </div>
              <div>
                <span className="k">Recipient</span>
                <span className="v">{order.recipient_name ?? '—'}</span>
              </div>
              <div>
                <span className="k">Recipient email</span>
                <span className="v small">{order.recipient_email ?? '—'}</span>
              </div>
              <div>
                <span className="k">Recipient phone</span>
                <span className="v small">{order.recipient_phone ?? '—'}</span>
              </div>
              <div>
                <span className="k">Payment reference</span>
                <span className="v small mono">{order.payment_reference ?? '—'}</span>
              </div>
              <div>
                <span className="k">Paid at</span>
                <span className="v small">{order.paid_at ? formatDateTime(order.paid_at) : 'Not paid'}</span>
              </div>
            </div>
            {order.gift_message ? (
              <div className="callout info" style={{ marginTop: 16 }}>
                <MessageSquare size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                {order.gift_message}
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Order status</h3>
            <StatusTag status={order.status} />
          </div>
          <div className="panel-body">
            <form action={adminSetOrderStatus} style={{ display: 'grid', gap: 14 }}>
              <input type="hidden" name="order_id" value={order.id} />
              <input type="hidden" name="return_to" value={`/admin/orders/${order.id}`} />
              <div className="field">
                <label htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue={order.status}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <button className="btn primary" type="submit">
                Save status
              </button>
              <p className="small muted">
                Marking an order paid sets the payment status and paid date. Refunding records the
                decision but does not move money — payments are handled outside this dashboard.
              </p>
            </form>

            <div className="divider" style={{ margin: '16px 0' }} />

            <div className="split-list">
              <div>
                <span className="k">Order ID</span>
                <span className="v mono small">{order.id}</span>
              </div>
              <div>
                <span className="k">Currency</span>
                <span className="v">{order.currency ?? 'QAR'}</span>
              </div>
              <div>
                <span className="k">Fee</span>
                <span className="v">{formatMoney(Number(order.fee_minor ?? 0))}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Items</h3>
          <span className="small muted">{items.length} line items</span>
        </div>
        <div className="panel-body flush">
          {items.length === 0 ? (
            <div className="table-empty">No line items on this order.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Gift</th>
                    <th>Vendor</th>
                    <th>Package</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit price</th>
                    <th className="num">Total</th>
                    <th className="num">Commission</th>
                    <th className="num">Vendor share</th>
                    <th>Recipient</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const product = Array.isArray(item.products) ? item.products[0] : item.products;
                    const vendorRelation = product?.vendors;
                    const vendor = Array.isArray(vendorRelation) ? vendorRelation[0] : vendorRelation;
                    const variant = Array.isArray(item.product_variants)
                      ? item.product_variants[0]
                      : item.product_variants;
                    return (
                      <tr key={item.id}>
                        <td>
                          <span className="strong">{product?.title ?? 'Gift'}</span>
                          <br />
                          <span className="sub">{fulfilmentLabel(product?.fulfilment_type ?? 'monetary')}</span>
                        </td>
                        <td className="small">{vendor?.name ?? 'Giftly'}</td>
                        <td className="small">
                          {variant ? (
                            <>
                              {variant.label}
                              {variant.session_count ? <span className="sub"> · {variant.session_count} sessions</span> : null}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="num">{item.quantity}</td>
                        <td className="num">{formatMoney(Number(item.unit_price_minor ?? 0))}</td>
                        <td className="num strong">{formatMoney(Number(item.total_minor ?? 0))}</td>
                        <td className="num">{formatMoney(Number(item.commission_minor ?? 0))}</td>
                        <td className="num">{formatMoney(Number(item.vendor_share_minor ?? 0))}</td>
                        <td className="small">{item.recipient_name ?? order.recipient_name ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Vouchers</h3>
          <Ticket size={16} />
        </div>
        <div className="panel-body flush">
          {vouchers.length === 0 ? (
            <div className="table-empty">No vouchers issued for this order yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Gift</th>
                    <th>Type</th>
                    <th>Recipient</th>
                    <th className="num">Value</th>
                    <th className="num">Remaining</th>
                    <th className="num">Sessions</th>
                    <th>Status</th>
                    <th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher) => {
                    const product = Array.isArray(voucher.products) ? voucher.products[0] : voucher.products;
                    return (
                      <tr key={voucher.id}>
                        <td className="mono small strong">{voucher.voucher_code}</td>
                        <td>{product?.title ?? 'Gift'}</td>
                        <td>
                          <span className="tag">{fulfilmentLabel(voucher.fulfilment_type)}</span>
                        </td>
                        <td className="small">
                          {voucher.recipient_name ?? '—'}
                          <br />
                          <span className="sub">{voucher.recipient_email ?? '—'}</span>
                        </td>
                        <td className="num">{formatMoney(Number(voucher.initial_value_minor ?? 0))}</td>
                        <td className="num">
                          {voucher.fulfilment_type === 'monetary'
                            ? formatMoney(Number(voucher.remaining_value_minor ?? 0))
                            : '—'}
                        </td>
                        <td className="num">
                          {voucher.total_sessions != null
                            ? `${voucher.remaining_sessions ?? 0}/${voucher.total_sessions}`
                            : '—'}
                        </td>
                        <td>
                          <StatusTag status={voucher.status} />
                        </td>
                        <td className="small muted">{voucher.expires_at ? formatDate(voucher.expires_at) : 'No expiry'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {(redemptions ?? []).length > 0 ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Redemptions</h3>
            <ScanLine size={16} />
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Voucher</th>
                    <th>Kind</th>
                    <th className="num">Amount</th>
                    <th className="num">Sessions</th>
                    <th>Service</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {(redemptions ?? []).map((redemption) => {
                    const voucher = vouchers.find((entry) => entry.id === redemption.voucher_id);
                    return (
                      <tr key={redemption.id}>
                        <td className="mono small strong">{redemption.reference}</td>
                        <td className="mono small">{voucher?.voucher_code ?? '—'}</td>
                        <td>{titleCase(redemption.kind)}</td>
                        <td className="num">
                          {redemption.amount_minor != null ? formatMoney(Number(redemption.amount_minor)) : '—'}
                        </td>
                        <td className="num">{redemption.sessions ?? '—'}</td>
                        <td className="small">{redemption.service_label ?? '—'}</td>
                        <td>
                          <StatusTag status={redemption.status} />
                        </td>
                        <td className="small muted">{formatDateTime(redemption.occurred_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <div className="callout info">
        <Package size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Need the buyer record?{' '}
        {order.buyer_id ? (
          <Link href={`/admin/customers/${order.buyer_id}`} style={{ textDecoration: 'underline' }}>
            Open the customer profile
          </Link>
        ) : (
          'This order has no linked buyer account.'
        )}
        .
      </div>
    </div>
  );
}
