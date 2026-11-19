import Link from 'next/link';
import { headers } from 'next/headers';
import { Mail, Plus, Search, Ticket } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminVoucherTotals } from '@/lib/aggregates';
import {
  adminEmailClaimLink,
  adminIssueManualVoucher,
  adminSetVoucherStatus,
} from '@/lib/actions/admin';
import { CopyField } from '@/components/CopyField';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { fulfilmentLabel } from '@/lib/catalog';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

const ACTIVE = ['issued', 'claimed', 'active', 'partially_redeemed'];
const STATUSES = [
  'issued',
  'claimed',
  'active',
  'partially_redeemed',
  'redeemed',
  'expired',
  'cancelled',
  'void',
];

export default async function AdminVouchersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    saved?: string;
    error?: string;
    issued?: string;
    claim?: string;
    emailed?: string;
  }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).vouchers;
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000';
  const proto =
    headerStore.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? `${proto}://${host}`;
  const c = pick(common, locale);
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';
  const type = params.type ?? '';

  const [{ data, error }, voucherTotals] = await Promise.all([
    ctx.supabase
      .from('vouchers')
      .select(
        'id, voucher_code, status, fulfilment_type, initial_value_minor, remaining_value_minor, total_sessions, remaining_sessions, recipient_name, recipient_email, claimed_by, expires_at, created_at, products(title, vendors(name)), orders(id, order_ref), profiles!buyer_id(full_name, email)',
      )
      .order('created_at', { ascending: false })
      .limit(2000),
    adminVoucherTotals(ctx.supabase),
  ]);

  const allVouchers = data ?? [];

  // Only products that a voucher can be invented for: partner codes come out
  // of an enterprise inventory batch instead.
  const { data: productRows } = await ctx.supabase
    .from('products')
    .select('id, title, fulfilment_type, vendors(name)')
    .eq('is_active', true)
    .in('fulfilment_type', ['monetary', 'experience'])
    .order('title');
  const issuableProducts = productRows ?? [];
  const vouchers = allVouchers.filter((voucher) => {
    if (status === 'active' && !ACTIVE.includes(voucher.status)) return false;
    if (status && status !== 'active' && voucher.status !== status) return false;
    if (type && voucher.fulfilment_type !== type) return false;
    if (!q) return true;
    const product = Array.isArray(voucher.products) ? voucher.products[0] : voucher.products;
    const buyer = Array.isArray(voucher.profiles) ? voucher.profiles[0] : voucher.profiles;
    const order = Array.isArray(voucher.orders) ? voucher.orders[0] : voucher.orders;
    return [voucher.voucher_code, voucher.recipient_name, voucher.recipient_email, product?.title, buyer?.full_name, buyer?.email, order?.order_ref]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <Notice
        error={params.error ?? error?.message}
        success={
          params.issued
            ? fill(t.manualCreated, { code: params.issued })
            : params.emailed
              ? fill(t.emailed, { email: params.emailed })
              : params.saved === '1'
                ? t.saved
                : null
        }
      />

      {params.claim ? (
        <div className="callout">
          <strong>{t.manualClaimTitle}</strong>
          <p className="small" style={{ marginTop: 6 }}>
            {t.manualClaimBody}
          </p>
          <CopyField value={`${origin}/claim/${params.claim}`} />
        </div>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Ticket size={17} />
          </span>
          <strong>{voucherTotals.total}</strong>
          <span>{t.allVouchers}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{voucherTotals.active}</strong>
          <span>{c.status.active}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{formatMoney(voucherTotals.outstandingMinor)}</strong>
          <span>{t.outstandingBalance}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{voucherTotals.redeemed}</strong>
          <span>{fill(t.expiredCount, { count: voucherTotals.expired })}</span>
        </div>
      </div>

      <details className="panel" style={{ marginBottom: 18 }}>
        <summary className="panel-head" style={{ cursor: 'pointer' }}>
          <h3>
            <Plus size={16} /> {t.manualTitle}
          </h3>
          <span className="small muted">{t.manualSubtitle}</span>
        </summary>
        <div className="panel-body">
          <p className="small muted">{t.manualBody}</p>
          <form action={adminIssueManualVoucher} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <div className="field">
              <label htmlFor="manual_product">{t.manualProduct}</label>
              <select id="manual_product" name="product_id" required defaultValue="">
                <option value="" disabled>
                  {t.manualProductPlaceholder}
                </option>
                {issuableProducts.map((product) => {
                  const vendorRelation = product.vendors;
                  const vendor = Array.isArray(vendorRelation) ? vendorRelation[0] : vendorRelation;
                  return (
                    <option key={product.id} value={product.id}>
                      {product.title}
                      {vendor?.name ? ` · ${vendor.name}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
              }}
            >
              <div className="field">
                <label htmlFor="manual_amount">{t.manualAmount}</label>
                <input
                  id="manual_amount"
                  name="amount"
                  inputMode="decimal"
                  placeholder={t.manualAmountPlaceholder}
                />
                <span className="small muted">{t.manualAmountHint}</span>
              </div>
              <div className="field">
                <label htmlFor="manual_expires">{t.manualExpires}</label>
                <input id="manual_expires" name="expires_on" type="date" />
                <span className="small muted">{t.manualExpiresHint}</span>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
              }}
            >
              <div className="field">
                <label htmlFor="manual_name">{t.manualRecipient}</label>
                <input id="manual_name" name="recipient_name" />
              </div>
              <div className="field">
                <label htmlFor="manual_email">{t.manualEmail}</label>
                <input id="manual_email" name="recipient_email" type="email" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="manual_message">{t.manualMessage}</label>
              <textarea id="manual_message" name="gift_message" rows={2} />
            </div>
            <div className="field">
              <label htmlFor="manual_note">{t.manualNote}</label>
              <input id="manual_note" name="note" placeholder={t.manualNotePlaceholder} />
            </div>
            <div className="btn-row">
              <button className="btn sm primary" type="submit" disabled={issuableProducts.length === 0}>
                <Plus size={15} /> {t.manualSubmit}
              </button>
            </div>
          </form>
        </div>
      </details>

      <form className="toolbar" action="/admin/vouchers" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder={t.searchPlaceholder} aria-label={t.searchLabel} />
        </div>
        <select name="type" defaultValue={type} aria-label={t.fulfilmentTypeLabel}>
          <option value="">{t.allTypes}</option>
          <option value="monetary">{c.fulfilment.gift_card}</option>
          <option value="experience">{c.fulfilment.experience}</option>
          <option value="enterprise_code">{c.fulfilment.enterprise_code}</option>
        </select>
        <select name="status" defaultValue={status} aria-label={t.statusLabel}>
          <option value="">{t.allStatuses}</option>
          <option value="active">{c.status.active}</option>
          {STATUSES.filter((value) => value !== 'active').map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || status || type ? (
          <Link className="btn sm ghost" href="/admin/vouchers">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      {vouchers.length === 0 ? (
        <EmptyState
          title={q || status || type ? t.noVouchersMatch : t.noVouchersYet}
          body={
            q || status || type
              ? t.tryDifferentSearch
              : t.emptyBody
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {fill(vouchers.length === 1 ? t.voucherCountOne : t.voucherCount, { count: vouchers.length })}
            </h3>
            <span className="small muted">{t.showingUpTo}</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{c.labels.code}</th>
                    <th>{t.gift}</th>
                    <th>{t.type}</th>
                    <th>{t.recipientBuyer}</th>
                    <th className="num">{c.labels.value}</th>
                    <th className="num">{t.remaining}</th>
                    <th>{c.labels.status}</th>
                    <th>{t.order}</th>
                    <th>{t.expires}</th>
                    <th>{t.issued}</th>
                    <th style={{ textAlign: 'right' }}>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher) => {
                    const product = Array.isArray(voucher.products) ? voucher.products[0] : voucher.products;
                    const vendorRelation = product?.vendors;
                    const vendor = Array.isArray(vendorRelation) ? vendorRelation[0] : vendorRelation;
                    const order = Array.isArray(voucher.orders) ? voucher.orders[0] : voucher.orders;
                    const buyer = Array.isArray(voucher.profiles) ? voucher.profiles[0] : voucher.profiles;
                    return (
                      <tr key={voucher.id}>
                        <td className="mono small strong">{voucher.voucher_code}</td>
                        <td>
                          {product?.title ?? t.gift}
                          <br />
                          <span className="sub">{vendor?.name ?? 'Giftly'}</span>
                        </td>
                        <td>
                          <span className="tag">{fulfilmentLabel(voucher.fulfilment_type, locale)}</span>
                        </td>
                        <td className="small">
                          {voucher.recipient_name ?? '—'}
                          <br />
                          <span className="sub">
                            {t.buyer}: {buyer?.full_name ?? buyer?.email ?? '—'}
                          </span>
                        </td>
                        <td className="num">{formatMoney(Number(voucher.initial_value_minor ?? 0))}</td>
                        <td className="num">
                          {voucher.fulfilment_type === 'monetary'
                            ? formatMoney(Number(voucher.remaining_value_minor ?? 0))
                            : voucher.total_sessions != null
                              ? `${voucher.remaining_sessions ?? 0}/${voucher.total_sessions}`
                              : '—'}
                        </td>
                        <td>
                          <StatusTag status={voucher.status} />
                        </td>
                        <td className="small">
                          {order ? (
                            <Link href={`/admin/orders/${order.id}`} style={{ textDecoration: 'underline' }}>
                              {order.order_ref}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="small muted">
                          {voucher.expires_at ? formatDate(voucher.expires_at, locale) : t.noExpiry}
                        </td>
                        <td className="small muted">{formatDate(voucher.created_at, locale)}</td>
                        <td>
                          {['void', 'expired', 'redeemed', 'cancelled'].includes(voucher.status) ? (
                            <span className="small muted">{t.closed}</span>
                          ) : (
                            <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                              {voucher.recipient_email && !voucher.claimed_by ? (
                                <form action={adminEmailClaimLink}>
                                  <input type="hidden" name="voucher_id" value={voucher.id} />
                                  <input type="hidden" name="return_to" value="/admin/vouchers" />
                                  <button
                                    className="btn sm ghost"
                                    type="submit"
                                    title={fill(t.emailHint, { email: voucher.recipient_email })}
                                  >
                                    <Mail size={14} /> {t.emailLink}
                                  </button>
                                </form>
                              ) : null}
                              <form action={adminSetVoucherStatus} className="inline-role" style={{ justifyContent: 'flex-end' }}>
                                <input type="hidden" name="voucher_id" value={voucher.id} />
                                <input type="hidden" name="return_to" value="/admin/vouchers" />
                                <select name="status" defaultValue="void" aria-label={fill(t.actionFor, { code: voucher.voucher_code })}>
                                  <option value="void">{t.void}</option>
                                  <option value="expired">{t.expire}</option>
                                </select>
                                <button className="btn sm ghost" type="submit">
                                  {c.actions.apply}
                                </button>
                              </form>
                            </div>
                          )}
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

      <div className="callout warn">
        {t.voidNote}
      </div>
    </div>
  );
}
