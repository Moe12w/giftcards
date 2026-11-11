import Link from 'next/link';
import { ScanLine, Search, Ticket } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { fulfilmentLabel } from '@/lib/catalog';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

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
        eyebrow="Redemptions"
        title="Vouchers"
        description="Every gift issued for your business, with its live balance or session count."
        actions={
          <Link className="btn sm primary" href="/vendor/redeem">
            <ScanLine size={15} /> Redeem a code
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
          <span>Active vouchers</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Ticket size={17} />
          </span>
          <strong>{data?.length ?? 0}</strong>
          <span>Issued in total</span>
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
          <strong>{(data ?? []).filter((voucher) => voucher.status === 'redeemed').length}</strong>
          <span>Fully redeemed</span>
        </div>
      </div>

      <form className="toolbar" action="/vendor/vouchers" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Code, recipient or gift…" aria-label="Search vouchers" />
        </div>
        <select name="status" defaultValue={status} aria-label="Voucher status">
          <option value="">All statuses</option>
          <option value="active">Active (issued, claimed or partial)</option>
          <option value="issued">Issued</option>
          <option value="claimed">Claimed</option>
          <option value="partially_redeemed">Partially redeemed</option>
          <option value="redeemed">Redeemed</option>
          <option value="expired">Expired</option>
          <option value="void">Void</option>
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/vendor/vouchers">
            Clear
          </Link>
        ) : null}
      </form>

      {vouchers.length === 0 ? (
        <EmptyState
          title={q || status ? 'No vouchers match' : 'No vouchers yet'}
          body={
            q || status
              ? 'Try a different code or clear the filters.'
              : 'When someone buys one of your gifts, the voucher code appears here.'
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>{vouchers.length} vouchers</h3>
            <span className="small muted">Codes are shown to your team only</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Gift</th>
                    <th>Type</th>
                    <th>Recipient</th>
                    <th className="num">Balance / sessions</th>
                    <th>Status</th>
                    <th>Expires</th>
                    <th>Issued</th>
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
                        <td>{product?.title ?? 'Gift'}</td>
                        <td>
                          <span className="tag">{fulfilmentLabel(voucher.fulfilment_type)}</span>
                        </td>
                        <td>{voucher.recipient_name ?? '—'}</td>
                        <td className="num">
                          {voucher.fulfilment_type === 'monetary'
                            ? `${formatMoney(Number(voucher.remaining_value_minor ?? 0))} / ${formatMoney(Number(voucher.initial_value_minor ?? 0))}`
                            : `${voucher.remaining_sessions ?? 0} / ${voucher.total_sessions ?? 0} sessions`}
                        </td>
                        <td>
                          <StatusTag status={voucher.status} />
                        </td>
                        <td className="small muted">{voucher.expires_at ? formatDate(voucher.expires_at) : 'No expiry'}</td>
                        <td className="small muted">{formatDate(voucher.created_at)}</td>
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
