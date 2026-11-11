import Link from 'next/link';
import { Search, Ticket } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { adminSetVoucherStatus } from '@/lib/actions/admin';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { fulfilmentLabel } from '@/lib/catalog';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

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
        eyebrow="Operations"
        title="Vouchers"
        description="Every gift code on the platform, with its live balance, session count and delivery state."
      />

      <Notice error={params.error ?? error?.message} success={params.saved === '1' ? 'Voucher updated.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Ticket size={17} />
          </span>
          <strong>{allVouchers.length}</strong>
          <span>All vouchers</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{active.length}</strong>
          <span>Active</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{formatMoney(outstanding)}</strong>
          <span>Outstanding balance</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{redeemed}</strong>
          <span>{expired} expired</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/vouchers" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Code, recipient, buyer or order…" aria-label="Search vouchers" />
        </div>
        <select name="type" defaultValue={type} aria-label="Fulfilment type">
          <option value="">All types</option>
          <option value="monetary">Gift card</option>
          <option value="experience">Experience</option>
          <option value="enterprise_code">Corporate code</option>
        </select>
        <select name="status" defaultValue={status} aria-label="Voucher status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          {STATUSES.filter((value) => value !== 'active').map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || status || type ? (
          <Link className="btn sm ghost" href="/admin/vouchers">
            Clear
          </Link>
        ) : null}
      </form>

      {vouchers.length === 0 ? (
        <EmptyState
          title={q || status || type ? 'No vouchers match' : 'No vouchers yet'}
          body={
            q || status || type
              ? 'Try a different search or clear the filters.'
              : 'Vouchers are created when a customer buys a gift.'
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {vouchers.length} {vouchers.length === 1 ? 'voucher' : 'vouchers'}
            </h3>
            <span className="small muted">Showing up to 2,000</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Gift</th>
                    <th>Type</th>
                    <th>Recipient / buyer</th>
                    <th className="num">Value</th>
                    <th className="num">Remaining</th>
                    <th>Status</th>
                    <th>Order</th>
                    <th>Expires</th>
                    <th>Issued</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
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
                          {product?.title ?? 'Gift'}
                          <br />
                          <span className="sub">{vendor?.name ?? 'Giftly'}</span>
                        </td>
                        <td>
                          <span className="tag">{fulfilmentLabel(voucher.fulfilment_type)}</span>
                        </td>
                        <td className="small">
                          {voucher.recipient_name ?? '—'}
                          <br />
                          <span className="sub">
                            Buyer: {buyer?.full_name ?? buyer?.email ?? '—'}
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
                        <td className="small muted">{voucher.expires_at ? formatDate(voucher.expires_at) : 'No expiry'}</td>
                        <td className="small muted">{formatDate(voucher.created_at)}</td>
                        <td>
                          {['void', 'expired', 'redeemed', 'cancelled'].includes(voucher.status) ? (
                            <span className="small muted">Closed</span>
                          ) : (
                            <form action={adminSetVoucherStatus} className="inline-role" style={{ justifyContent: 'flex-end' }}>
                              <input type="hidden" name="voucher_id" value={voucher.id} />
                              <input type="hidden" name="return_to" value="/admin/vouchers" />
                              <select name="status" defaultValue="void" aria-label={`Action for ${voucher.voucher_code}`}>
                                <option value="void">Void</option>
                                <option value="expired">Expire</option>
                              </select>
                              <button className="btn sm ghost" type="submit">
                                Apply
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
        Voiding a voucher stops it being redeemed immediately. Expiring marks it as out of date. Both
        actions are recorded in the audit log.
      </div>
    </div>
  );
}
