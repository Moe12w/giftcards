import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, FileSpreadsheet, Send, Upload } from 'lucide-react';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { sendBulkGiftLinks } from '@/lib/actions/business';
import { emailProviderReady } from '@/lib/email';
import { businessCopy } from '@/lib/i18n/business';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function BusinessOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; assigned?: string; sent?: string; summary?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireApprovedBusinessBuyer();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(businessCopy, locale);

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
    .order('assignment_index', { ascending: true });

  const rows = (allocations ?? []) as any[];
  const withRecipient = rows.filter((r) => r.recipient_email);
  const issued = rows.filter((r) => r.voucher_id);
  const sentCount = rows.filter((r) => r.delivery_status === 'sent').length;
  const queuedCount = rows.filter((r) => r.delivery_status === 'queued').length;
  const failedCount = rows.filter((r) => r.delivery_status === 'failed').length;
  const providerReady = emailProviderReady();
  const isIssued = ['fulfilled', 'partially_fulfilled'].includes(order.status);

  const success =
    sp.created === '1'
      ? t.orders.open
      : sp.assigned === '1'
        ? t.order.assigned
        : sp.saved === '1'
          ? t.order.saved
          : sp.sent === '1'
            ? sp.summary ?? t.order.sendTitle
            : null;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.order.summary}
        title={order.order_ref}
        description={`${order.vendors?.name ?? ''} · ${order.bulk_offers?.title ?? order.products?.title ?? ''} · ${formatDate(order.created_at, locale)}`}
        actions={
          <div className="btn-row">
            <Link className="btn sm ghost" href="/business/orders"><ArrowLeft size={15} /> {t.order.backToOrders}</Link>
            <a className="btn sm" href={`/business/orders/${order.id}/export`}><Download size={15} /> {t.order.downloadCsv}</a>
          </div>
        }
      />
      <Notice error={sp.error} success={success} />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head"><h3>{t.order.summary}</h3><StatusTag status={order.status} /></div>
          <div className="panel-body">
            <div className="split-list">
              <div><span className="k">{t.orders.ref}</span><span className="v">{order.order_ref}</span></div>
              <div><span className="k">{t.offer.vendor}</span><span className="v">{order.vendors?.name ?? '—'}</span></div>
              <div><span className="k">{t.offer.giftCard}</span><span className="v">{order.bulk_offers?.title ?? order.products?.title ?? '—'}</span></div>
              <div><span className="k">{t.orders.quantity}</span><span className="v">{order.quantity}</span></div>
              <div><span className="k">{t.offer.faceValue}</span><span className="v">{formatMoney(order.face_value_minor)}</span></div>
              <div><span className="k">{t.orders.unitPaid}</span><span className="v strong">{formatMoney(order.unit_price_minor)}</span></div>
              <div><span className="k">{t.checkout.totalFace}</span><span className="v">{formatMoney(order.total_face_value_minor)}</span></div>
              <div><span className="k">{t.orders.totalPaid}</span><span className="v strong">{formatMoney(order.total_paid_minor)}</span></div>
              <div><span className="k">{t.orders.discount}</span><span className="v">{formatMoney(order.discount_minor)}</span></div>
              <div><span className="k">{t.orders.payment}</span><span className="v">{order.payment_status}</span></div>
              <div><span className="k">{t.orders.placed}</span><span className="v">{formatDate(order.created_at, locale)}</span></div>
              {order.paid_at ? <div><span className="k">{t.order.paidAt}</span><span className="v">{formatDate(order.paid_at, locale)}</span></div> : null}
            </div>

            <div className="callout info" style={{ marginTop: 16 }}>
              <strong>{t.order.accounting}</strong>
              <div className="split-list" style={{ marginTop: 8 }}>
                <div><span className="k">{t.order.platformFee}</span><span className="v">{formatMoney(order.platform_fee_minor)}</span></div>
                <div><span className="k">{t.order.vendorPayable}</span><span className="v">{formatMoney(order.vendor_payable_minor)}</span></div>
                <div><span className="k">{t.order.redemptionValue}</span><span className="v">{formatMoney(order.total_face_value_minor)}</span></div>
              </div>
              <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>{t.order.accountingNote}</p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>{t.order.invoice}</h3></div>
          <div className="panel-body">
            <div className="split-list">
              <div><span className="k">{t.order.billedCompany}</span><span className="v">{ctx.account.company_name}</span></div>
              <div><span className="k">{t.order.contact}</span><span className="v">{ctx.account.contact_name} ({ctx.account.business_email})</span></div>
              <div><span className="k">{t.order.currency}</span><span className="v">{order.currency}</span></div>
              <div><span className="k">{t.order.amount}</span><span className="v strong">{formatMoney(order.total_paid_minor)}</span></div>
            </div>
            <a className="btn sm" style={{ marginTop: 12 }} href={`/business/orders/${order.id}/export`}>
              <FileSpreadsheet size={15} /> {t.order.downloadCsv}
            </a>
            <p className="small muted" style={{ marginTop: 8 }}>{t.order.downloadNote}</p>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h3>{t.order.recipients}</h3>
          <Link className="btn sm" href={`/business/orders/${order.id}/recipients`}>
            <Upload size={15} /> {t.order.uploadCsv}
          </Link>
        </div>
        <div className="panel-body">
          <p className="small muted">{t.order.recipientsBody}</p>

          <div className="split-list" style={{ marginTop: 8 }}>
            <div><span className="k">{t.orders.quantity}</span><span className="v">{order.quantity}</span></div>
            <div><span className="k">{t.order.recipient}</span><span className="v">{withRecipient.length}</span></div>
            <div><span className="k">{t.order.code}</span><span className="v">{issued.length}</span></div>
            <div><span className="k">{t.order.deliveryStatus}</span><span className="v">{t.order.deliverySummary.replace('{sent}', String(sentCount)).replace('{queued}', String(queuedCount)).replace('{failed}', String(failedCount))}</span></div>
          </div>

          {!isIssued ? (
            <div className="callout" style={{ marginTop: 12 }}>
              {t.order.pendingIssuance}
            </div>
          ) : null}

          <form action={sendBulkGiftLinks} style={{ marginTop: 12 }}>
            <input type="hidden" name="order_id" value={order.id} />
            <button className="btn primary" type="submit" disabled={!isIssued || withRecipient.length === 0}>
              <Send size={15} /> {t.order.sendAll}
            </button>
            {!providerReady ? <span className="small muted" style={{ marginInlineStart: 10 }}>{t.order.queuedNote}</span> : null}
          </form>
          <p className="small muted" style={{ marginTop: 8 }}>{t.order.sendBody}</p>

          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.order.recipient}</th>
                  <th>{t.order.email}</th>
                  <th>{t.order.code}</th>
                  <th>{t.order.claimLink}</th>
                  <th>{t.order.deliveryStatus}</th>
                  <th style={{ textAlign: 'right' }}>{t.orders.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td className="small">{row.recipient_name || '—'}</td>
                    <td className="small">{row.recipient_email || '—'}</td>
                    <td className="small">{row.voucher_code || row.delivered_code || t.order.notIssued}</td>
                    <td className="small">
                      {row.claim_token ? (
                        <a href={`/claim/${row.claim_token}`} target="_blank" rel="noreferrer">{t.order.openLink}</a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td><StatusTag status={row.delivery_status || 'pending'} /></td>
                    <td>
                      <div className="row-actions">
                        <form action={sendBulkGiftLinks}>
                          <input type="hidden" name="order_id" value={order.id} />
                          <input type="hidden" name="allocation_id" value={row.id} />
                          <button className="btn sm" type="submit" disabled={!isIssued || !row.recipient_email || !row.claim_token}>
                            {t.order.sendOne}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
