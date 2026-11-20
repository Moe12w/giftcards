import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { adminRecordVendorSettlement } from '@/lib/actions/admin-payments';

export const dynamic = 'force-dynamic';

export default async function AdminSettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    recorded?: string;
    vendor?: string;
    status?: string;
    q?: string;
  }>;
}) {
  await requireAdmin();
  const query = await searchParams;

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const { data: vendors } = await admin
    .from('vendors')
    .select('id, name, myfatoorah_supplier_code')
    .order('name')
    .limit(500);

  let settlementQuery = admin
    .from('vendor_settlements')
    .select('id, vendor_id, supplier_code, settlement_reference, amount_minor, status, settlement_date, notes, created_at, vendors(id, name)')
    .order('settlement_date', { ascending: false })
    .limit(200);
  if (query.vendor) settlementQuery = settlementQuery.eq('vendor_id', query.vendor);
  if (query.status) settlementQuery = settlementQuery.eq('status', query.status);
  if (query.q) settlementQuery = settlementQuery.ilike('settlement_reference', `%${query.q}%`);

  const { data: settlements } = await settlementQuery;
  const rows = settlements ?? [];

  const totals = rows.reduce(
    (acc: { pending: number; completed: number; failed: number }, row: any) => {
      acc[row.status as 'pending' | 'completed' | 'failed'] += Number(row.amount_minor ?? 0);
      return acc;
    },
    { pending: 0, completed: 0, failed: 0 },
  );

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Platform administration"
        title="Settlements"
        description="Manual record of MyFatoorah deposits. Settlement amounts move money already earned; they do not create new vendor income."
      />

      <Notice
        error={query.error}
        success={query.recorded === '1' ? 'Settlement recorded.' : null}
      />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-label">Completed</span>
          <strong>{formatMoney(totals.completed)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Pending</span>
          <strong>{formatMoney(totals.pending)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Failed</span>
          <strong>{formatMoney(totals.failed)}</strong>
        </div>
      </div>

      <div className="dash-grid" style={{ marginTop: 18 }}>
        <section className="panel">
          <div className="panel-head">
            <h3>Record a settlement</h3>
          </div>
          <div className="panel-body">
            <form action={adminRecordVendorSettlement} className="form" style={{ display: 'grid', gap: 14 }}>
              <div className="field">
                <label htmlFor="vendor_id">Vendor</label>
                <select id="vendor_id" name="vendor_id" required defaultValue="">
                  <option value="" disabled>
                    Choose a vendor
                  </option>
                  {(vendors ?? []).map((vendor: any) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                      {vendor.myfatoorah_supplier_code ? ` · ${vendor.myfatoorah_supplier_code}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="settlement_reference">Provider / bank reference</label>
                <input id="settlement_reference" name="settlement_reference" required placeholder="e.g. DEP-2026-001" />
              </div>
              <div className="field">
                <label htmlFor="amount_minor">Amount (QAR)</label>
                <input id="amount_minor" name="amount_minor" type="number" min="0.01" step="0.01" required />
              </div>
              <div className="field">
                <label htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue="completed">
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="settlement_date">Settlement date</label>
                <input id="settlement_date" name="settlement_date" type="date" />
              </div>
              <div className="field">
                <label htmlFor="supplier_code">Supplier code (optional)</label>
                <input id="supplier_code" name="supplier_code" placeholder="From MyFatoorah" />
              </div>
              <div className="field">
                <label htmlFor="notes">Notes</label>
                <textarea id="notes" name="notes" rows={3} placeholder="Statement line, deposit terms, anything the vendor should know." />
              </div>
              <button className="btn primary" type="submit">
                Save settlement
              </button>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Filters</h3>
            <Link className="small" href="/admin/settlements">
              Clear
            </Link>
          </div>
          <div className="panel-body">
            <form method="get" className="toolbar">
              <select name="vendor" defaultValue={query.vendor ?? ''}>
                <option value="">All vendors</option>
                {(vendors ?? []).map((vendor: any) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
              <select name="status" defaultValue={query.status ?? ''}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              <input name="q" defaultValue={query.q ?? ''} placeholder="Search reference" />
              <button className="btn sm" type="submit">
                Apply
              </button>
            </form>
            <p className="small muted" style={{ marginTop: 12 }}>
              MyFatoorah does not expose a settlement-reporting API for this account. Record deposits from the provider
              statement here; each vendor sees the same record in Financials.
            </p>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <h3>Settlement history</h3>
          <span className="tag neutral">{rows.length}</span>
        </div>
        <div className="panel-body">
          {rows.length === 0 ? (
            <p className="small muted">No settlements recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Vendor</th>
                    <th>Supplier</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any) => {
                    const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
                    return (
                      <tr key={row.id}>
                        <td className="mono">{row.settlement_reference}</td>
                        <td>{vendor?.name ?? row.vendor_id}</td>
                        <td className="mono">{row.supplier_code ?? '—'}</td>
                        <td>{formatMoney(Number(row.amount_minor ?? 0))}</td>
                        <td>
                          <StatusTag status={row.status} />
                        </td>
                        <td>{row.settlement_date ? formatDate(row.settlement_date) : '—'}</td>
                        <td className="small muted">{row.notes ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
