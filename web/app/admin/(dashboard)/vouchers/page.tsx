import Link from 'next/link';
import { Search, Ticket } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminSetVoucherStatus } from '@/lib/actions/admin';
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
  searchParams: Promise<{ q?: string; status?: string; type?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).vouchers;
  const c = pick(common, locale);
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';
  const type = params.type ?? '';

  const { data, error } = await ctx.supabase
    .from('vouchers')
    .select(
      'id, voucher_code, status, fulfilment_type, initial_value_minor, remaining_value_minor, total_sessions, remaining_sessions, recipient_name, recipient_email, expires_at, created_at, products(title, vendors(name)), orders(id, order_ref), profiles(full_name, email)',
    )
    .order('created_at', { ascending: false })
    .limit(2000);

  const allVouchers = data ?? [];
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

  const active = allVouchers.filter((voucher) => ACTIVE.includes(voucher.status));
  const outstanding = active
    .filter((voucher) => voucher.fulfilment_type === 'monetary')
    .reduce((sum, voucher) => sum + Number(voucher.remaining_value_minor ?? 0), 0);
  const redeemed = allVouchers.filter((voucher) => voucher.status === 'redeemed').length;
  const expired = allVouchers.filter((voucher) => voucher.status === 'expired').length;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? t.saved : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Ticket size={17} />
          </span>
          <strong>{allVouchers.length}</strong>
          <span>{t.allVouchers}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{active.length}</strong>
          <span>{c.status.active}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{formatMoney(outstanding)}</strong>
          <span>{t.outstandingBalance}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{redeemed}</strong>
          <span>{fill(t.expiredCount, { count: expired })}</span>
        </div>
      </div>

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
