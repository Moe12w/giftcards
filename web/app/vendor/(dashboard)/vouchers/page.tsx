import Link from 'next/link';
import { ScanLine, Search, Ticket } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { fulfilmentLabel } from '@/lib/catalog';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { fill, pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

const ACTIVE = ['issued', 'claimed', 'active', 'partially_redeemed'];

export default async function VendorVouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).vouchers;
  const c = pick(common, locale);

  const { data, error } = await ctx.supabase
    .from('vouchers')
    .select('id, voucher_code, status, fulfilment_type, initial_value_minor, remaining_value_minor, total_sessions, remaining_sessions, recipient_name, expires_at, created_at, products(title)')
    .eq('vendor_id', ctx.vendor.id)
    .order('created_at', { ascending: false })
    .limit(600);

  const vouchers = (data ?? []).filter((voucher) => {
    const product = Array.isArray(voucher.products) ? voucher.products[0] : voucher.products;
    if (status === 'active' && !ACTIVE.includes(voucher.status)) return false;
    if (status && status !== 'active' && voucher.status !== status) return false;
    if (!q) return true;
    return [voucher.voucher_code, voucher.recipient_name, product?.title]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const active = (data ?? []).filter((voucher) => ACTIVE.includes(voucher.status));
  const outstanding = active.reduce((sum, voucher) => {
    if (voucher.fulfilment_type === 'monetary') {
      return sum + Number(voucher.remaining_value_minor ?? 0);
    }
    return sum;
  }, 0);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          <Link className="btn sm primary" href="/vendor/redeem">
            <ScanLine size={15} /> {t.redeemCode}
          </Link>
        }
      />

      <Notice error={params.error ?? error?.message} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Ticket size={17} />
          </span>
          <strong>{active.length}</strong>
          <span>{t.activeVouchers}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{data?.length ?? 0}</strong>
          <span>{t.issuedInTotal}</span>
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
          <strong>{(data ?? []).filter((voucher) => voucher.status === 'redeemed').length}</strong>
          <span>{t.fullyRedeemed}</span>
        </div>
      </div>

      <form className="toolbar" action="/vendor/vouchers" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input
            name="q"
            defaultValue={params.q ?? ''}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchLabel}
          />
        </div>
        <select name="status" defaultValue={status} aria-label={t.statusLabel}>
          <option value="">{t.allStatuses}</option>
          <option value="active">{t.activeFilter}</option>
          <option value="issued">{c.status.issued}</option>
          <option value="claimed">{c.status.claimed}</option>
          <option value="partially_redeemed">{c.status.partially_redeemed}</option>
          <option value="redeemed">{c.status.redeemed}</option>
          <option value="expired">{c.status.expired}</option>
          <option value="void">{c.status.void}</option>
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/vendor/vouchers">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      {vouchers.length === 0 ? (
        <EmptyState
          title={q || status ? t.noMatchTitle : t.emptyTitle}
          body={q || status ? t.noMatchBody : t.emptyBody}
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>{fill(t.voucherCount, { count: vouchers.length })}</h3>
            <span className="small muted">{t.codesNote}</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{c.labels.code}</th>
                    <th>{t.gift}</th>
                    <th>{c.labels.type}</th>
                    <th>{t.recipient}</th>
                    <th className="num">{t.balanceSessions}</th>
                    <th>{c.labels.status}</th>
                    <th>{t.expires}</th>
                    <th>{c.status.issued}</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((voucher) => {
                    const product = Array.isArray(voucher.products) ? voucher.products[0] : voucher.products;
                    return (
                      <tr key={voucher.id}>
                        <td>
                          <span className="strong mono">{voucher.voucher_code}</span>
                        </td>
                        <td>{product?.title ?? t.gift}</td>
                        <td>
                          <span className="tag">{fulfilmentLabel(voucher.fulfilment_type, locale)}</span>
                        </td>
                        <td>{voucher.recipient_name ?? '—'}</td>
                        <td className="num">
                          {voucher.fulfilment_type === 'monetary'
                            ? `${formatMoney(Number(voucher.remaining_value_minor ?? 0))} / ${formatMoney(Number(voucher.initial_value_minor ?? 0))}`
                            : `${voucher.remaining_sessions ?? 0} / ${voucher.total_sessions ?? 0} ${c.time.sessions}`}
                        </td>
                        <td>
                          <StatusTag status={voucher.status} />
                        </td>
                        <td className="small muted">
                          {voucher.expires_at ? formatDate(voucher.expires_at, locale) : t.noExpiry}
                        </td>
                        <td className="small muted">{formatDate(voucher.created_at, locale)}</td>
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
