import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

export default async function AdminAdvertisingFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; vendor?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const kindFilter = params.kind ?? '';
  const vendorFilter = params.vendor ?? '';

  const [transactionsResult, ledgerResult, creditsResult, vendorsResult] = await Promise.all([
    ctx.supabase
      .from('advertising_transactions')
      .select('*, vendors(name), advertising_campaigns(name, campaign_ref)')
      .order('created_at', { ascending: false })
      .limit(1000),
    ctx.supabase
      .from('advertising_ledger_entries')
      .select('*, vendors(name), advertising_campaigns(name, campaign_ref)')
      .order('created_at', { ascending: false })
      .limit(1000),
    ctx.supabase
      .from('advertising_promotional_credits')
      .select('*, vendors(name)')
      .order('created_at', { ascending: false })
      .limit(500),
    ctx.supabase.from('vendors').select('id, name').order('name', { ascending: true }).limit(500),
  ]);

  const transactions = (transactionsResult.data ?? []).filter((row: any) => {
    if (kindFilter && row.kind !== kindFilter) return false;
    if (vendorFilter && row.vendor_id !== vendorFilter) return false;
    return true;
  });
  const ledger = (ledgerResult.data ?? []).filter((row: any) => {
    if (vendorFilter && row.vendor_id !== vendorFilter) return false;
    return true;
  });
  const credits = (creditsResult.data ?? []).filter((row: any) => {
    if (vendorFilter && row.vendor_id !== vendorFilter) return false;
    return true;
  });
  const vendors = vendorsResult.data ?? [];

  const allTransactions = transactionsResult.data ?? [];
  const payments = allTransactions.filter((row: any) => row.kind === 'payment' && row.status === 'succeeded');
  const refunds = allTransactions.filter((row: any) => row.kind === 'refund' && row.status === 'succeeded');
  const charges = allTransactions.filter((row: any) =>
    ['cpc_charge', 'cpm_charge', 'fixed_charge'].includes(row.kind) && row.status === 'succeeded',
  );
  const gross = payments.reduce((sum: number, row: any) => sum + Number(row.amount_minor ?? 0), 0);
  const refunded = refunds.reduce((sum: number, row: any) => sum + Number(row.amount_minor ?? 0), 0);
  const chargeVolume = charges.reduce((sum: number, row: any) => sum + Number(row.amount_minor ?? 0), 0);
  const outstandingCredit = credits
    .filter((row: any) => row.status === 'available')
    .reduce((sum: number, row: any) => sum + Number(row.remaining_minor ?? 0), 0);

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Advertising & promotions"
        title="Advertising finance"
        description="Payments, delivery charges, refunds and promotional credit. This ledger is completely separate from gift-card sales, settlements and wallet balances."
        actions={
          <Link className="btn sm ghost" href="/admin/advertising">
            Advertising overview
          </Link>
        }
      />
      <Notice error={params.error ?? transactionsResult.error?.message} success={params.saved === '1' ? 'Saved.' : null} />

      <div className="kpi-grid">
        <div className="kpi">
          <strong>{formatMoney(gross)}</strong>
          <span>Verified payments</span>
        </div>
        <div className="kpi">
          <strong>{formatMoney(refunded)}</strong>
          <span>Refunds</span>
        </div>
        <div className="kpi">
          <strong>{formatMoney(gross - refunded)}</strong>
          <span>Net advertising revenue</span>
        </div>
        <div className="kpi">
          <strong>{formatMoney(chargeVolume)}</strong>
          <span>Delivery charged to budgets</span>
        </div>
        <div className="kpi">
          <strong>{formatMoney(outstandingCredit)}</strong>
          <span>Outstanding promotional credit</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/advertising/finance" method="get">
        <select name="kind" defaultValue={kindFilter} aria-label="Transaction kind">
          <option value="">All kinds</option>
          {['payment', 'fixed_charge', 'cpc_charge', 'cpm_charge', 'refund', 'credit', 'renewal', 'adjustment'].map((kind) => (
            <option key={kind} value={kind}>{kind.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select name="vendor" defaultValue={vendorFilter} aria-label="Advertiser">
          <option value="">All advertisers</option>
          {vendors.map((vendor: any) => (
            <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
          ))}
        </select>
        <button className="btn sm" type="submit">Filter</button>
        {kindFilter || vendorFilter ? (
          <Link className="btn sm ghost" href="/admin/advertising/finance">Clear</Link>
        ) : null}
      </form>

      {transactions.length === 0 ? (
        <EmptyState title="No advertising transactions" body="Verified advertising payments, charges and refunds appear here." />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>Transactions</h3>
            <span className="small muted">Unique provider references and idempotency keys</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Advertiser / campaign</th>
                    <th className="num">Amount</th>
                    <th>Status</th>
                    <th>Provider reference</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((row: any) => (
                    <tr key={row.id}>
                      <td><span className="tag neutral">{row.kind.replace(/_/g, ' ')}</span></td>
                      <td>
                        <span className="small">{row.vendors?.name ?? '—'}</span>
                        <div className="sub">{row.advertising_campaigns?.name ?? row.advertising_campaigns?.campaign_ref ?? ''}</div>
                      </td>
                      <td className="num">{formatMoney(row.amount_minor)}</td>
                      <td><StatusTag status={row.status} /></td>
                      <td className="small mono">{row.provider_reference ?? '—'}</td>
                      <td className="small muted">{formatDateTime(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h3>Ledger</h3>
          <span className="small muted">Advertising-only double-entry view</span>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>Advertiser / campaign</th>
                  <th>Direction</th>
                  <th className="num">Amount</th>
                  <th className="num">Balance after</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted small">No ledger entries yet.</td>
                  </tr>
                ) : (
                  ledger.map((row: any) => (
                    <tr key={row.id}>
                      <td>
                        <span className="small">{row.entry_type.replace(/_/g, ' ')}</span>
                        <div className="sub mono">{row.entry_key}</div>
                      </td>
                      <td>
                        <span className="small">{row.vendors?.name ?? '—'}</span>
                        <div className="sub">{row.advertising_campaigns?.name ?? ''}</div>
                      </td>
                      <td><span className={`tag ${row.direction === 'credit' ? 'success' : 'neutral'}`}>{row.direction}</span></td>
                      <td className="num">{formatMoney(row.amount_minor)}</td>
                      <td className="num">{formatMoney(row.balance_after_minor)}</td>
                      <td className="small muted">{formatDateTime(row.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Promotional credit</h3>
          <span className="small muted">Granted by admins, spent FIFO at checkout</span>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Advertiser</th>
                  <th className="num">Granted</th>
                  <th className="num">Remaining</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Note</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {credits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted small">No promotional credit has been granted.</td>
                  </tr>
                ) : (
                  credits.map((row: any) => (
                    <tr key={row.id}>
                      <td>{row.vendors?.name ?? '—'}</td>
                      <td className="num">{formatMoney(row.amount_minor)}</td>
                      <td className="num">{formatMoney(row.remaining_minor)}</td>
                      <td><StatusTag status={row.status} /></td>
                      <td className="small muted">{row.expires_at ? formatDateTime(row.expires_at) : '—'}</td>
                      <td className="small">{row.note ?? '—'}</td>
                      <td className="small muted">{formatDateTime(row.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
