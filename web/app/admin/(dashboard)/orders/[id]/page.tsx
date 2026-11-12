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
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

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
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).orderDetail;
  const c = pick(common, locale);

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
        <ArrowLeft size={15} /> {t.backToOrders}
      </Link>

      <PageHead
        eyebrow={t.eyebrow}
        title={order.order_ref}
        description={`${formatDateTime(order.created_at, locale)} · ${itemCount} ${itemCount === 1 ? t.itemOne : t.items} · ${vouchers.length} ${vouchers.length === 1 ? t.voucherOne : t.vouchers}`}
        actions={
          <>
            <StatusTag status={order.status} />
            <span className="tag neutral">{titleCase(order.payment_status ?? '—', locale)}</span>
          </>
        }
      />

      <Notice error={query.error ?? error?.message} success={query.saved === '1' ? t.saved : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <CreditCard size={17} />
          </span>
          <strong>{formatMoney(Number(order.total_minor ?? 0))}</strong>
          <span>{t.orderTotal}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <ShoppingBag size={17} />
          </span>
          <strong>{formatMoney(Number(order.subtotal_minor ?? 0))}</strong>
          <span>{t.subtotal}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{formatMoney(Number(order.discount_minor ?? 0))}</strong>
          <span>{t.discount}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Truck size={17} />
          </span>
          <strong>{titleCase(order.delivery_method ?? '—', locale)}</strong>
          <span>{order.scheduled_for ? formatDateTime(order.scheduled_for, locale) : t.immediateDelivery}</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.buyerAndRecipient}</h3>
            <Mail size={16} />
          </div>
          <div className="panel-body">
            <div className="split-list">
              <div>
                <span className="k">{t.buyer}</span>
                <span className="v">
                  {buyer?.full_name ?? order.sender_name ?? t.guest}
                  {buyer?.email ? <span className="small muted"> · {buyer.email}</span> : null}
                </span>
              </div>
              <div>
                <span className="k">
                  <Phone size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.buyerPhone}
                </span>
                <span className="v small">{buyer?.phone ?? '—'}</span>
              </div>
              <div>
                <span className="k">{t.recipient}</span>
                <span className="v">{order.recipient_name ?? '—'}</span>
              </div>
              <div>
                <span className="k">{t.recipientEmail}</span>
                <span className="v small">{order.recipient_email ?? '—'}</span>
              </div>
              <div>
                <span className="k">{t.recipientPhone}</span>
                <span className="v small">{order.recipient_phone ?? '—'}</span>
              </div>
              <div>
                <span className="k">{t.paymentReference}</span>
                <span className="v small mono">{order.payment_reference ?? '—'}</span>
              </div>
              <div>
                <span className="k">{t.paidAt}</span>
                <span className="v small">{order.paid_at ? formatDateTime(order.paid_at, locale) : t.notPaid}</span>
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
            <h3>{t.orderStatus}</h3>
            <StatusTag status={order.status} />
          </div>
          <div className="panel-body">
            <form action={adminSetOrderStatus} style={{ display: 'grid', gap: 14 }}>
              <input type="hidden" name="order_id" value={order.id} />
              <input type="hidden" name="return_to" value={`/admin/orders/${order.id}`} />
              <div className="field">
                <label htmlFor="status">{c.labels.status}</label>
                <select id="status" name="status" defaultValue={order.status}>
                  <option value="pending">{c.status.pending}</option>
                  <option value="paid">{c.status.paid}</option>
                  <option value="failed">{c.status.failed}</option>
                  <option value="refunded">{t.refunded}</option>
                </select>
              </div>
              <button className="btn primary" type="submit">
                {t.saveStatus}
              </button>
              <p className="small muted">
                {t.markingPaidNote}
              </p>
            </form>

            <div className="divider" style={{ margin: '16px 0' }} />

            <div className="split-list">
              <div>
                <span className="k">{t.orderId}</span>
                <span className="v mono small">{order.id}</span>
              </div>
              <div>
                <span className="k">{t.currency}</span>
                <span className="v">{order.currency ?? 'QAR'}</span>
              </div>
              <div>
                <span className="k">{t.fee}</span>
                <span className="v">{formatMoney(Number(order.fee_minor ?? 0))}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>{t.items}</h3>
          <span className="small muted">{fill(t.lineItems, { count: items.length })}</span>
        </div>
        <div className="panel-body flush">
          {items.length === 0 ? (
            <div className="table-empty">{t.noLineItems}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.gift}</th>
                    <th>{t.vendor}</th>
                    <th>{t.package}</th>
                    <th className="num">{t.qty}</th>
                    <th className="num">{t.unitPrice}</th>
                    <th className="num">{c.labels.total}</th>
                    <th className="num">{t.commission}</th>
                    <th className="num">{t.vendorShare}</th>
                    <th>{t.recipient}</th>
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
                          <span className="strong">{product?.title ?? t.gift}</span>
                          <br />
                          <span className="sub">{fulfilmentLabel(product?.fulfilment_type ?? 'monetary', locale)}</span>
                        </td>
                        <td className="small">{vendor?.name ?? 'Giftly'}</td>
                        <td className="small">
                          {variant ? (
                            <>
                              {variant.label}
                              {variant.session_count ? (
                                <span className="sub"> · {fill(t.sessions, { count: variant.session_count })}</span>
                              ) : null}
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
          <h3>{t.vouchers}</h3>
          <Ticket size={16} />
        </div>
        <div className="panel-body flush">
          {vouchers.length === 0 ? (
            <div className="table-empty">{t.noVouchersIssued}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{c.labels.code}</th>
                    <th>{t.gift}</th>
                    <th>{t.type}</th>
                    <th>{t.recipient}</th>
                    <th className="num">{c.labels.value}</th>
                    <th className="num">{t.remaining}</th>
                    <th className="num">{t.sessionsCount}</th>
                    <th>{c.labels.status}</th>
                    <th>{t.expires}</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher) => {
                    const product = Array.isArray(voucher.products) ? voucher.products[0] : voucher.products;
                    return (
                      <tr key={voucher.id}>
                        <td className="mono small strong">{voucher.voucher_code}</td>
                        <td>{product?.title ?? t.gift}</td>
                        <td>
                          <span className="tag">{fulfilmentLabel(voucher.fulfilment_type, locale)}</span>
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
                        <td className="small muted">
                          {voucher.expires_at ? formatDate(voucher.expires_at, locale) : t.noExpiry}
                        </td>
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
            <h3>{t.redemptions}</h3>
            <ScanLine size={16} />
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{c.labels.reference}</th>
                    <th>{t.voucher}</th>
                    <th>{t.kind}</th>
                    <th className="num">{c.labels.amount}</th>
                    <th className="num">{t.sessionsCount}</th>
                    <th>{t.service}</th>
                    <th>{c.labels.status}</th>
                    <th>{t.when}</th>
                  </tr>
                </thead>
                <tbody>
                  {(redemptions ?? []).map((redemption) => {
                    const voucher = vouchers.find((entry) => entry.id === redemption.voucher_id);
                    return (
                      <tr key={redemption.id}>
                        <td className="mono small strong">{redemption.reference}</td>
                        <td className="mono small">{voucher?.voucher_code ?? '—'}</td>
                        <td>{titleCase(redemption.kind, locale)}</td>
                        <td className="num">
                          {redemption.amount_minor != null ? formatMoney(Number(redemption.amount_minor)) : '—'}
                        </td>
                        <td className="num">{redemption.sessions ?? '—'}</td>
                        <td className="small">{redemption.service_label ?? '—'}</td>
                        <td>
                          <StatusTag status={redemption.status} />
                        </td>
                        <td className="small muted">{formatDateTime(redemption.occurred_at, locale)}</td>
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
        <Package size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.needBuyer}{' '}
        {order.buyer_id ? (
          <Link href={`/admin/customers/${order.buyer_id}`} style={{ textDecoration: 'underline' }}>
            {t.openCustomerProfile}
          </Link>
        ) : (
          t.noLinkedBuyer
        )}
        .
      </div>
    </div>
  );
}
